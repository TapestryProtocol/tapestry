# Story 8: `graph search` — find concepts and elements by the words in their names and fields, best first, each match with the field it matched in and a passage, from a point of view

**Status:** Approved
**Created:** 2026-11-16
**Type:** Feature
**Loom:** A10.8 — https://loom.brainstorm.world/t/A10.8

## Background

Loom's A10.8 asks for one graph read (catalog §1, Graph reads): **`graph search`**, which finds "concepts and elements by text". It takes `q`, `kind?`, `concept?`, `pov?` and `limit`, and answers "matches (tapestryKey, name, kind, concepts)". Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/search` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

Ten facts shape the story:

- **Today an agent writes its own Cypher.** No route searches the graph. An agent sends Cypher to `POST /api/neo4j/query`, whose reads anyone may send. Avi's agent did this in his race. Every read was a substring match over a node's whole JSON, `toLower(t.value) CONTAINS $w`, and the agent parsed the JSON itself. The matches were noisy: "og" hit "dog", and "map" hit every Treasure Map rule. One question took 20 queries. (Avi's comment on nousclawds4/tapestry#32, 2026-11-07.)
- **The race is what search is measured against.** The book's frame says that round 3 of Avi's race (15 questions), rerun against the rebuilt brain, must get at least 14 right. It must also take fewer tokens and less time than today's sources took in that round: 224k tokens and 7.1 minutes. The rerun is A10.40, and it waits on this task and on the rebuild (A10.39).
  - In round 3 the brain held the right file for every question and got 14 right. It took 273k tokens and 11.4 minutes, in 73 queries and 37 file fetches. Avi's summary: "the cost was in reading it, not in what it held."
  - Later, a local passage search over the brain got 15 of 15, in about 213k tokens and 8.0 minutes. It met the token bar and missed the time bar (Avi's second comment, 2026-11-08).
- **Which text round 3's answers came from.** Names and titles missed most questions. The hits came from rule statements and section headings. These are the fields Avi's reads filtered on or returned. Each is a string or a list of strings.
  - a rule's `statement` and `strength`;
  - a document's or a specification's `title`, `description` and `headings` (up to 80);
  - a decision record's `recordStatus` and `decidedOn`;
  - for anything read from a file, `sourceRepo`, `sourcePath`, `sourceCommit` and `sourceBranch`.

  Avi asks for three things:
  - search field values, not only names;
  - answer the field that matched, with a short passage around the words. With names only, every hit costs another call to see whether it is relevant, and the docs connectors won on cost because they answer passages;
  - match words, not substrings, and rank the results.
- **The owner's two-step idea** (design doc §5, question 7): "first, use cypher to do a keyword match against name, description, and keywords, but only against Concept Header nodes, not all nodes in the graph. That restriction can improve performance. Second, walk the graph, with the walk depending on the nature of the search. Perhaps return elements of the matching concept header; or maybe walk the graph to find closely related, but not identical, concepts, that may be what the user is looking for but don't have the right keywords -- for example, if they are in a different language." The design doc's drafting notes add three things:
  - no relationship type says "the same concept in another language";
  - concept headers have no `keywords` field;
  - "Avi's race found its hits in element fields, so concept headers make one entry point rather than the only one."
- **Walk is built for search to call.** Walk's ADR (graph-operations-first-slice/0014, Decision 3) says how search calls it:
  - search's first step gives the nodes the walk starts from;
  - the search story picks the types, the direction and the depth for each strategy;
  - search chooses which nodes to start from when more match than a walk takes (100).

  Walk itself is being built in a parallel session (A10.14). Its ADR is merged, but its code isn't on staging yet.
- **Where the words live today.** The local instance (2026-11-17, read only) runs Neo4j 5.26.10. It holds 10,446 nodes, 55 of them concept headers.
  - A node's name is a property of the node (545 nodes have one), and so is its slug (91). Everything else is in the JSON tag of the node's letter (492 nodes have one: 1,366 characters on average, and 30,443 at the longest). That includes a concept's plural and description, a set's description and an element's fields. An element's fields sit in its JSON's section for each concept it belongs to.
  - A concept can mark a field, so that each of its elements carries the field's value on its own node, as `<concept key>_<field>` (`graph mark-field`, ADR graph-operations-foundation/0005). No field is marked on this instance yet.
  - The graph has no full-text index, although Neo4j ships them.
- **`graph resolve` answers a different question.** resolve (A10.9) gives the nodes that a name, a slug or an address names exactly, ignoring case, and never picks one. Search answers which nodes are about some words, best first. An agent with a name calls resolve. An agent with a question calls search.
- **The read conventions exist** (ADR graph-operations-first-slice/0011, and 0013 for relationships).
  - A read that answers a list pages with `limit` (1 to 200, 50 by default) and a cursor.
  - A read that can include other authors' nodes takes `pov`: the owner's point of view by default, or `everyone`. The test runs inside the read's own query, nothing about a point of view is stored, and the answer says how many items it kept and left out.
  - A node is answered with five facts: tapestryKey, name, address, author, and whether it is the instance's own.
  - Walk's amendment to ADR 0011 (Amendment 4) lets a read page nearest first. That is the one exception to the rule that an item's place never changes.
- **Reads stay behind sign-in, and write nothing.** The book's frame says: "Until read visibility is decided (catalog §10, question 1), the new read routes require an owner or admin sign-in."
- **Agents already have a way in.** The external CLI (A10.6) makes a command of each operation the instance lists, so search reaches agents with no change to the CLI.

## User-facing description

As an admin agent answering a question from a brain like Avi's, or as the owner, I want to search the graph by words. I want back, best first, the concepts and elements whose names or fields hold those words, each with the field it matched in and a short passage around them. Then I can tell which match answers my question without a call for each one, and without writing Cypher.

As the same agent, I want to narrow a search to one kind of node, or to one concept's elements ("rules only"), so that a word common across the graph doesn't bury what I'm after.

As the same agent, I want the search read from a point of view, the owner's unless I ask for another. Then it never answers a node by an untrusted author, and it tells me how many it left out.

As the owner, I want a search to be able to start from the concepts its words name and walk out from them, as in my two-step idea. Then a question asked in words other than an element's own can still reach it. How much of this search packages is ADR 0008's decision, made at its gate (open questions, For Architecture).

## Acceptance criteria

- [ ] **AC1 — Words find concepts and elements** (open question 1). The owner or an admin is signed in and calls `GET /api/tapestry/graph/search` with `q`. The answer lists the nodes whose text holds `q`'s words.
  - A node's text is its name and the values of its fields: a concept's plural and its description, and an element's fields such as a rule's statement or a document's headings.
  - The owner sets nothing up first.
  - A word matches only as a whole word, ignoring case. `q=og` doesn't match a node whose only text containing "og" is "dog".
  - Tag nodes and change entries are never answered.
  - A search that matches nothing answers an empty list.
- [ ] **AC2 — Each match, with where it matched** (open question 1). Each match comes with:
  - the five facts;
  - its kind: `concept`, `superset`, `set` or `node`, as `graph resolve` answers one;
  - the concepts it is an element of, each by tapestryKey and name;
  - where its words were found: the field they were in, or its name, and a passage of that text, at most 200 characters long, that holds them.

  A field longer than 200 characters is never answered whole. A node that search answers because a walk reached it from a match, not because of its own words, says so. It comes with the path that reached it, given as walk gives a path (ADR 0014), and with no passage.
- [ ] **AC3 — Best first, a page at a time** (open question 2).
  - Matches come best first:
    - a node that holds every word of `q` comes before one that holds only some;
    - then by how well each matches;
    - then by tapestryKey, so the same graph gives the same order every time.
  - A page holds at most `limit` matches (1 to 200, 50 by default) and has a cursor for the next page, null on the last.
  - Passing each page's cursor in turn answers every match exactly once, as long as the graph doesn't change between pages.
- [ ] **AC4 — Narrowed by kind, or to one concept's elements.**
  - With `kind=concept`, search answers only concepts. With `kind=set`, it answers only supersets and sets.
  - With `concept`, a concept header's tapestryKey, it answers only that concept's elements, through the concept's class thread as `graph list-elements` reads it. "Rules only" is `concept` set to the rule concept's key.
  - With both, a node must meet both.
- [ ] **AC5 — From a point of view: the owner's, by default.**
  - With no `pov`, search answers only nodes that count by the read conventions' test, and a walk steps only onto nodes that count (ADR 0013, C6).
  - The answer says how many matches it kept and how many it left out because they don't count. Both counts cover the whole list, not just the page. It also says when the owner's scores don't exist yet.
  - `pov=everyone` answers every author's nodes.
  - Nothing about a point of view is stored. The same graph answers differently with no write in between when it is searched from another point of view, or after the owner's scores change.
  - A `pov` the instance can't read from is refused, and the refusal says which points of view it can read from.
- [ ] **AC6 — What it refuses.** search refuses each of these. It changes nothing, and it says in words what was wrong, naming the input:
  - no `q`, a `q` with no word in it, a `q` longer than the length the Architect sets, and a `q` that holds a control character;
  - a `kind` other than `concept` or `set`;
  - a `concept` that isn't a tapestryKey, one that names no node, and one that names a node that isn't a concept header, saying what that node is;
  - a `limit` out of range;
  - a cursor this read didn't give for the same `q`, `kind`, `concept` and point of view;
  - an input the read doesn't take.
- [ ] **AC7 — A read, behind sign-in, that agents can use at the size of Avi's brain.**
  - search writes nothing: no change, and no change entry.
  - A caller who isn't signed in is refused with 401. A signed-in person who is neither the owner nor an admin is refused with 403.
  - It is listed for agents and has its `/docs` entry, both made from its declaration.
  - Someone with a shell inside the instance can run `tapestry graph search --q <words>` with no sign-in and get the route's answers.
  - On a scratch stack holding a brain the size of Avi's (946 documents and 3,576 rules), an admin agent with its own key uses the external CLI (A10.6), with no change to the CLI. It finds a rule by words in its statement, and a document by words in one of its headings. Each search answers in under a second.
  - If search needs something new in an instance's Neo4j, an existing instance gets it when it upgrades and a fresh one gets it when it starts. Nothing in the graph is removed or rewritten to make that so.
  - Today's `POST /api/neo4j/query` keeps answering as it does.

That makes seven criteria for one read. AC2's last part applies whenever the strategy the ADR chooses walks.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- `39998:<TA>:concept-header` (concept header, read): what a concept match is. Its names and its description are part of its text.
- `39998:<TA>:word` and `39998:<TA>:word-wrapper` (word and word wrapper, read): the JSON every node's letter carries, which holds its fields.
- `39998:<TA>:neo4j-property` (neo4j property, read): a field's mark, which copies the field onto each element's node. Its set of neo4j-only properties ships empty, for "metadata such as search strings".
- `39998:<TA>:superset` and `39998:<TA>:set` (read): two of a match's kinds.
- `39998:<TA>:class-thread` (class thread, read): how `concept` finds a concept's elements.
- `39998:<TA>:nostr-user`, `39998:<TA>:web-of-trust` and `39998:<TA>:graperank` (read): the authors and scores that decide whether a match counts from the owner's point of view.
- No firmware concept's definition changes in this story. If the strategy the ADR picks needs such a change, the ADR says so.

## Out of scope

- **Search by meaning** (embeddings and a vector index). An agent searches in the words a node uses, or narrows with `concept`.
- **"The same concept in another language."** No relationship type says so yet (design doc §5, question 7). A walk can find such a concept once one does.
- **Keywords on concept headers.** Headers have no `keywords` field. Adding one changes the firmware's concept header and needs a write.
- **Searching outside the graph:** nostr events the instance hasn't imported, other instances, and people's profiles. Profile search is Brainstorm Search's own, in Meilisearch.
- **A node's whole fields.** That is `graph describe-node` (A10.10).
- **Naming `concept` by its name or slug** (the refs hook, A10.9.a). It takes a tapestryKey, and an agent calls `graph resolve` first.
- **Points of view besides the owner's and everyone's** (ADR 0011, debt 2).
- **Letting visitors read** (catalog §10, question 1). Avi's brain is public on purpose, but that is visibility's question, not search's.
- **Today's `POST /api/neo4j/query`,** which stays as it is (D15).
- **Rebuilding Avi's brain (A10.39) and rerunning the race (A10.40),** which wait on this task.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change. The owner approved the story as drafted, choosing the proposal for each of the three and keeping the carried-over defaults (2026-11-16).

1. **What search finds, and what a match tells.** *Resolved, as proposed: match whole words, not substrings, in a node's name and in any of its fields, with nothing to mark or set up first. Each match comes with the field the words were found in and a passage of at most 200 characters around them* (AC1, AC2). This is what Avi's round 3 says an agent needs: names and titles missed most questions, and with names only every match costs another call to judge it. Other choices:
   - names only, as the catalog's first draft answers a match (tapestryKey, name, kind, concepts). An agent then has to read each match to judge it.
   - concept headers only, then a walk: the owner's two-step on its own. It finds a concept and its elements, but no rule by the words of its statement.
   - only the fields a concept marks (`graph mark-field`), so the people who keep a concept choose what search reads. A field nobody marks is never found.
   - the whole matched field. Some run to thousands of characters: the longest JSON here is 30,443.
   - the proposal, plus the values of fields the caller names (`fields?`). Round 3's "is it decided, and still in force?" reads a decision record's `recordStatus` and `decidedOn`. Under the proposal, search finds the record, but its status comes only in a passage or from `graph describe-node` (A10.10), and the race's rerun doesn't wait on describe-node.
2. **The order, and paging.** *Resolved, as proposed: best first. A node with every word comes before one with some, then the better match, then the lower tapestryKey. Pages come with `limit` and a cursor.* This is how walk pages nearest first, with the same exception: a change between two pages can move a match to a page already read, or show it twice. An amendment to ADR 0011 would name the exception, as walk's did (AC3). Other choices:
   - best first, with no cursor: only the best `limit`, and a count of how many more matched. The catalog's draft takes `limit` only.
   - by tapestryKey, with a cursor, as list-elements pages. No change between pages moves a match, but the best matches are spread through every page.
3. **Which of round 3's questions search is for.** *Resolved, as proposed: the story names the kinds of question round 3 asked, taken from Avi's public comment, not the questions themselves:*
   - *finding the file that answers a question, by a document's title, description or headings;*
   - *finding rules by their words, and a kind's MUST rules;*
   - *whether a decision is made and still in force, which turns on a decision record's status and date and its SUPERCEDES and AMENDS links.*

   *Search is for all of the first two kinds, and for finding the record in the third.* The questions and their checked answers are private. Avi sent them to the owner, since some answers draw on his private notes, and they aren't on this Mac. For the story to name questions by number instead, with no question text, it needs the round-3 list from the owner.

**Carried over from the reads already built** (kept by the owner, 2026-11-16):
- `kind` takes `concept` or `set`, as `graph resolve`'s does, and a match's kind is the one resolve gives (AC2, AC4). Another choice would be `concept` or `element`.
- `concept` takes a concept header's tapestryKey, as every node input does until the refs hook exists (A10.9.a) (AC4).
- `pov`, sign-in and the five facts work as they do in every read (AC2, AC5, AC7).
- A search answers in under a second at the size of Avi's brain (AC7). This is the drafting's proposal: the Architect measures it, and the ADR may change it with the live check's numbers.

**For Architecture, not this gate:**

- **How search finds its matches.** This is ADR 0008's main decision, and the owner's to make at its gate. The ADR lays out three things:
  - the owner's two-step: concept headers matched by keyword with Cypher, then a walk out from them;
  - Avi's full-text index over field values, answering the matched field and a passage (Neo4j 5.26 ships Lucene's full-text indexes);
  - any mix of the two.

  For each, it says which of round 3's kinds of question it finds and what it costs, and it recommends one. Walk's ADR left the walk's types, direction and depth for each strategy to this story. They pass to ADR 0008 along with the strategies, as does which nodes to start from when more than 100 match.
- **Which fields search reads, and how.** The JSON's `word` section repeats the same words on every core node ("concept header for the concept of dogs"). Those words shouldn't make every header a match for "concept". The neo4j-only properties set is one possible home for search strings.
- **How words match:** case; plurals and other forms of a word ("rule" and "rules"); words with punctuation or digits in them (`39999`, `A10.8`, `d-tag`); text in other languages; and how a passage is cut from a field, or from a list such as headings.
- **How matches rank,** including a text match against a node a walk reached, and what "how well" means in AC3.
- **If search needs an index:**
  - how the index is made on an existing instance and on a fresh one;
  - how it keeps up with a new concept or a new mark;
  - what it costs to keep;
  - that nothing wipes or rebuilds local graph state to get it (CLAUDE.md principle 4, BIBLE §30).
- **Meilisearch,** which the stack runs for profile search. The ADR weighs it and says why or why not, against principles 1–4: the point of view is applied at read time, and Neo4j is the definitive self.
- **The live check.** A scratch stack is seeded with a brain the size of Avi's: 946 documents with headings, and 3,576 rules with statements, since his build scripts are private. The check times a search there and sets the limits from what it finds, `q`'s length among them (AC6).
- **The test fakes,** which run none of a full-text index's queries.
- **Walk's code isn't on staging yet** (A10.14). If the build needs it before A10.14 merges, the build stops at the implementation gate rather than copying it.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Race and "Reads stay behind sign-in" bullets)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D11, D15; §5, questions 1 and 7); [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md) (Conventions, §1, §10 question 1)
- The evidence: Avi's two comments on nousclawds4/tapestry#32 (2026-11-07 and 2026-11-08)
- The conventions this read follows: [ADR graph-operations-first-slice/0011](../../decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md) (paging, the point of view, a node); [ADR graph-operations-first-slice/0013](../../decisions/graph-operations-first-slice/0013-list-relationships-and-the-relationship-conventions.md) (a relationship, answered and judged)
- The walk search calls: [14-walk.md](14-walk.md); [ADR graph-operations-first-slice/0014](../../decisions/graph-operations-first-slice/0014-walk.md), Decision 3
- Naming a node: [ADR graph-operations-first-slice/0009](../../decisions/graph-operations-first-slice/0009-resolve-and-naming-a-node.md)
- Field marks: [ADR graph-operations-foundation/0005](../../decisions/graph-operations-foundation/0005-field-mapping.md)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0008-search.md](../../decisions/graph-operations-first-slice/0008-search.md) (and its Amendment 5 to [ADR 0011](../../decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md))
- Test plan: [8-search.test-plan.md](8-search.test-plan.md)
- Review: (filled in after Review phase)
