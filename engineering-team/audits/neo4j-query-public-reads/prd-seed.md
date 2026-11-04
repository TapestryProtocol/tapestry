# PRD Seed: Anyone can read the graph; nobody can use it to reach the server

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/neo4j-query-public-reads/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for §3; medium elsewhere
**Date:** 2026-11-03

> A reverse-engineered baseline built from what shipped: a strawman for the product team, not a ratified spec.
> Tags: `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[INFERRED]` A Tapestry instance's graph is open to read. Visitors browse concepts, lists and their members through
the public pages, and those pages read the graph through one open endpoint that accepts queries. `[FROM FRAME]` That
openness covers the graph only: a visitor can't use it to make the server fetch things, reach the owner's controls,
read the server's setup, or interrupt the owner's work.

## 2. Personas

- `[INFERRED]` **A visitor**, not signed in, browsing an instance's public pages.
- `[INFERRED]` **The instance owner**, whose imports, firmware installs and settings must not be reachable by
  visitors.
- `[INFERRED]` **Someone probing the instance**, who sends the open endpoint queries no page sends.

## 3. Scope (as-built)

- `[FROM FRAME]` A visitor's query runs only if it reads the graph and nothing else.
- `[FROM FRAME]` The public pages work as before.
- `[FROM FRAME]` The owner's own queries are not limited.
- `[INFERRED]` Not in scope: how long a visitor's read may run, and whether the open query endpoint should exist at all
  for visitors.

## 4. Domain model

`[INFERRED]` No new entities. The things involved are the graph, the open query endpoint, and two kinds of caller:
the owner's side and everyone else.

## 5. Design rules (as-built)

- `[INFERRED]` A refused visitor query answers with a plain reason ("Public queries may only read the graph").
- `[UNKNOWN — product input needed]` No rule says which reads a visitor is entitled to. Today it is "any plain read",
  because the pages send open queries; named reads would make that a list someone chose.

## 6. Carry-forward & open questions

Promoted from the build audit §6:
- A time limit on visitors' reads.
- Named reads for the public pages, replacing the open endpoint for visitors.
- Ending the rule that a request from inside the server is the owner's.
- Re-checking the visitor rules on each database upgrade.

## 7. What product must validate

- [ ] Should a visitor be able to run *any* plain read of the graph, or only the reads the public pages need? (This
      decides whether the open endpoint stays public.)
- [ ] How long may a visitor's read take before it's stopped, and what should the page say when it is?
- [ ] Is there anything in an instance's graph that should not be readable by visitors at all? (Principle 4 makes
      the graph the owner's personal knowledge graph; today all of it is readable.)
