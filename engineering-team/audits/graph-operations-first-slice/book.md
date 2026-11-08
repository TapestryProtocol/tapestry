# Book of Work: Graph operations, first slice — the operations a brain rebuild needs

**Slug:** graph-operations-first-slice
**Status:** Open
**Opened:** 2026-11-07
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** The owner's direction, 2026-11-07: "build and use these tools, one operation at a time", since "We mostly need to know that the overall structure is a good one." The design is [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (decisions D1–D12), and the operations are drafted in [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md). The benchmark is Avi's brain experiment, from his comment on PR nousclawds4/tapestry#32 (2026-11-07): a brain of the team's public docs at avi.tapestry.ninja (946 documents and decision records from 13 repos, 599 rules, about 8,000 typed links), a race against today's sources, and a ledger of 29 gaps. The bullets restate the ask in drafting, not in the owner's words. The owner confirmed them on 2026-11-07 ("Yes, confirm it"), so they are the definition of done.

### Acceptance frame

- [ ] **Foundation.** Each operation is declared once, and its route, internal CLI command and `/docs` entry come from that declaration. Every node has a unique tapestryKey under one shared label with a uniqueness constraint, today's nodes included. Writes run their guards, record which admin made each change, and never sign. A concept can mark the fields its elements carry as Neo4j properties.
- [ ] **Backup.** The owner can take a full Neo4j backup and restore it on a fresh instance, with every tapestryKey intact.
- [ ] **The rebuild.** An agent with only its own key, made an admin, and the instance's URL rebuilds Avi's brain on a fresh instance through the new operations, with no raw Cypher. The operations are built one at a time, in the order the rebuild needs them, and used as each one lands.
- [ ] **The ledger.** Every gap in Avi's ledger that falls to the operations module is closed, or named as left to a later book, with the reason.
- [ ] **The race.** Round 3 of Avi's race (15 questions), rerun against the rebuilt brain, gets at least 14 right, with fewer tokens and less time than today's sources took in that round (224k tokens, 7.1 minutes).
- [ ] **Reads stay behind sign-in.** Until read visibility is decided (catalog §10, question 1), the new read routes require an owner or admin sign-in.

Outside the frame: publishing to nostr (the second priority); importing other people's nostr events, unless the race turns out to need them; making raw writes owner only, which waits until no job needs raw Cypher; and shipping to staging or production, which waits for the owner's OK.

The book depends on Avi's build scripts, his race questions with their checked answers, and his gap ledger, which he offered to send. Which external CLI the agent uses (design doc §5, question 6) is settled at the planning gate.

## Epics in this book
- [graph-operations-foundation](../../epics/graph-operations-foundation.md) (named 2026-11-08, at story 1's planning; Loom A10.1–A10.6) — the operation declaration that generates each route, CLI command and `/docs` entry; a tapestryKey on every node; the write path; the field mapping; backup; the external CLI and the agent's skill.
- graph-operations-first-slice (proposed; named at planning) — the operations the rebuild needs, built one at a time, then the rebuild and the race.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/graph-operations-first-slice/audit.md`
- Product feedback: `engineering-team/audits/graph-operations-first-slice/prd-seed.md`
