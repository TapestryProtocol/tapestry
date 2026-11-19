# Epic: graph-operations-first-slice

**Created:** 2026-11-15
**Status:** Active

## Goal

Build the operations the rebuild of Avi's brain needs, one at a time and in the order it needs them, on the foundation of
[graph-operations-foundation](graph-operations-foundation.md); then rebuild the brain through them and rerun the race.
The operations are those of the catalog, [docs/GRAPH_OPERATIONS_CATALOG.md](../../docs/GRAPH_OPERATIONS_CATALOG.md),
each a task in Loom block A10 (A10.7 onwards) that anyone on the team can take.

This epic realizes the Rebuild, Ledger and Race bullets of book
[engineering-team/audits/graph-operations-first-slice/book.md](../audits/graph-operations-first-slice/book.md).

## Why it matters

The owner wants agents to change a Tapestry's concept graph through operations that keep it valid, and each teammate
wants to build the operation they need when they need it, and use it the day it lands (Loom A10, "Why it matters").
The rebuild (A10.39) is the test that the operations are enough: an agent with only its own admin key and the
instance's URL rebuilds the brain on a fresh instance, with no raw Cypher.

## Stories

Each story is planned when its task is taken, and is numbered by its Loom task, as the foundation's are (A10.n is story
n, and its first ADR 000n), because teammates plan them at the same time in different sessions.

8. `stories/graph-operations-first-slice/8-search.md` — find concepts and elements by the words in their names and
    fields, best first, each match with the field it matched in and a passage, from a point of view; the read the rerun
    of Avi's race (A10.40) waits on (Loom A10.8).
9. `stories/graph-operations-first-slice/9-resolve.md` — turn a name, slug or nostr address into the tapestryKeys it
    could mean, from a point of view, reporting any ambiguity; the resolution every input that names a node will use
    (Loom A10.9).
11. `stories/graph-operations-first-slice/11-list-elements.md` — list the elements of a concept or a set, a page at a
    time, from a point of view, the owner's by default; its ADR sets the paging, the point of view and the node shape
    every graph read follows (Loom A10.11).
13. `stories/graph-operations-first-slice/13-list-relationships.md` — list a node's relationships, in and out, each
    with the way it points, a page at a time, from a point of view; its ADR sets how a relationship is answered and
    judged, for graph walk and describe-node (Loom A10.13).
14. `stories/graph-operations-first-slice/14-walk.md` — follow chosen relationship types out from one or more nodes, up
    to a depth, from a point of view, each node reached once with a shortest path, nearest first, a page at a time,
    within a bound; the walk search (A10.8) will call (Loom A10.14).
16. `stories/graph-operations-first-slice/16-create-concept-and-update-concept.md` — make a concept with its eight core
    nodes and no event, and change its names, slug or description (Loom A10.16).
18. `stories/graph-operations-first-slice/18-property-operations.md` — add, change and remove a concept's properties,
    or make them match a whole JSON Schema, with no event, the concept's schema following from its properties; the
    first write on a concept gives the fields its schema already lists their property nodes, and each write reports
    the elements that stop fitting (Loom A10.18).
19. `stories/graph-operations-first-slice/19-enumerate.md` — make a property's allowed values the elements of another
    concept, with one `ENUMERATES` from its superset to the property that carries only its type; each value is the
    `tapestry:<tapestryKey>` of one of its elements, checked by the element writes as the concept grows and shrinks;
    and take the link back with `graph unenumerate` (Loom A10.19).
20. `stories/graph-operations-first-slice/20-create-element.md` — make an element of a concept, or of a set in its class
    thread, with no event, its fields checked against the concept's schema; brings BIBLE §10's rule 4 into the
    rulebook as one check the later element writes reuse (Loom A10.20).
21. `stories/graph-operations-first-slice/21-update-node.md` — change one of this instance's own elements' name,
    description or fields, with no event, each section it changes checked against its concept's schema; brings the
    check that refuses a node from someone else's event (D4), which merge-nodes and delete-node will reuse (Loom A10.21).
22. `stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md` — make any node an element of
    another concept, or put it in a set, its new section checked against the concept's schema and kept beside another
    author's letter, and take the owner's claim out again, never out of the node's last concept; brings D9's rule into
    the rulebook (Loom A10.22).
23. `stories/graph-operations-first-slice/23-move-element.md` — move an element from one set or superset of a concept
    to another in one write, never in both or in neither, its concepts, JSON and fields left as they were; refuses sets
    of different concepts, a set that doesn't hold the node directly, and a link that isn't the owner's (Loom A10.23).
26. `stories/graph-operations-first-slice/26-delete-node.md` — delete one of this instance's own elements, with its
    relationships and tags, the whole node kept in its change entry so a mistake can be undone; teaches the shared test
    of whose node it is the person nodes and placeholders the import makes (Loom A10.26).
27. `stories/graph-operations-first-slice/27-create-set.md` — make a set under a concept's superset or another set,
    with no event, safe to repeat by name under the parent; the last write the rebuild waits on (Loom A10.27).
28. `stories/graph-operations-first-slice/28-link-set-and-unlink-set.md` — put an existing set, or a concept's
    superset, under another parent, refusing a cycle, and take a set out from under one of its parents, refusing its
    last parent (Loom A10.28).
41. `stories/graph-operations-first-slice/41-graph-rule-concept.md` — the graph rules as a firmware concept on every
    instance, one item per rulebook entry, made from the rulebook and the rules' code; the items `rules list-rules`
    (A10.31) will read (Loom A10.41).
42. `stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md` — the rule `element-fits-schema` and
    the derive step both judge a node's tapestryJson, and give one verdict, as ADR 0020a decides; the writes stop
    reporting `word` as failing for `graphContext` (Loom A10.20.b). A subtask has no A10 number of its own, so it takes
    the next number free; a later A10.42 takes another.
43. `stories/graph-operations-first-slice/43-concept-writes-take-header-lock.md` — a rename by graph update-concept,
    or a field mark by graph mark-field, beside a property write on the same concept: the two go one after the other,
    and neither is lost; closes ADR 0018's known limit of the lock (Loom A10.18.a, a subtask, numbered as story 42).
44. `stories/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.md` — the Concepts page and
    the Dashboard's Concepts tile show a concept made with no event, as they show any other, and its row offers no
    Disposition… until it has an event; a bug left by story 16, with no Loom task of its own, so it takes the next
    number free.

## Key facts / guardrails

- **One declaration per operation, in files of its own,** through the write path for every graph write (ADR
  graph-operations-foundation/0004), so parallel builders never edit the same file.
- **Routes live under `/api/tapestry/<group>/<operation>`** (D13); the command is `tapestry <group> <operation>`.
- **Callers:** the owner and admins. New reads stay behind sign-in until read visibility is decided (catalog §10,
  question 1).
- **Nothing here signs a nostr event** (D1). Publishing is `export nostr` (A10.34).
- **Live checks run on a scratch stack** (`scripts/scratch-stack.sh`), never on a shared or private instance.
- **Loom tracks each story as its A10 task;** the story's pull request names the task id.
