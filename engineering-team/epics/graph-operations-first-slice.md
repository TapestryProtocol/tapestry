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

11. `stories/graph-operations-first-slice/11-list-elements.md` — list the elements of a concept or a set, a page at a
    time, from a point of view, the owner's by default; its ADR sets the paging, the point of view and the node shape
    every graph read follows (Loom A10.11).
13. `stories/graph-operations-first-slice/13-list-relationships.md` — list a node's relationships, in and out, each
    with the way it points, a page at a time, from a point of view; its ADR sets how a relationship is answered and
    judged, for graph walk and describe-node (Loom A10.13).
16. `stories/graph-operations-first-slice/16-create-concept-and-update-concept.md` — make a concept with its eight core
    nodes and no event, and change its names, slug or description (Loom A10.16).
28. `stories/graph-operations-first-slice/28-link-set-and-unlink-set.md` — put an existing set, or a concept's
    superset, under another parent, refusing a cycle, and take a set out from under one of its parents, refusing its
    last parent (Loom A10.28).
41. `stories/graph-operations-first-slice/41-graph-rule-concept.md` — the graph rules as a firmware concept on every
    instance, one item per rulebook entry, made from the rulebook and the rules' code; the items `rules list-rules`
    (A10.31) will read (Loom A10.41).

## Key facts / guardrails

- **One declaration per operation, in files of its own,** through the write path for every graph write (ADR
  graph-operations-foundation/0004), so parallel builders never edit the same file.
- **Routes live under `/api/tapestry/<group>/<operation>`** (D13); the command is `tapestry <group> <operation>`.
- **Callers:** the owner and admins. New reads stay behind sign-in until read visibility is decided (catalog §10,
  question 1).
- **Nothing here signs a nostr event** (D1). Publishing is `export nostr` (A10.34).
- **Live checks run on a scratch stack** (`scripts/scratch-stack.sh`), never on a shared or private instance.
- **Loom tracks each story as its A10 task;** the story's pull request names the task id.
