# add-node-as-element rewrites a concept's concept graph as a bare `{ graph }`, which drops its word block, slugs, imports and relationship, and today's install does it to three firmware concepts on every run

**Id:** 2026-11-20-add-node-flattens-concept-graphs
**Type:** bug
**Opened:** 2026-11-20 (story graph-operations-first-slice #37, `lifecycle seed-firmware`, at Test Design)
**Status:** OPEN
**Done:** —

**What was seen.** `POST /api/normalize/add-node-as-element` (`src/api/normalize/index.js:3929`) makes a node an element of a concept, then rewrites that concept's concept graph (`:3970-3992`). The new JSON is `{ graph: { nodes: [{ uuid, name }], relationshipTypes: [...], relationships: [] } }`, re-signed through `regenerateJson`. Against what create-concept made, the concept graph loses:
- its `word` block;
- each node's `slug`, which the graph concept's schema requires (`firmware/active/concepts/graph/json-schema.json`);
- its `imports` (the property tree graph and the core nodes graph);
- its one relationship, the header's `IS_THE_CONCEPT_FOR` its superset;
- its `conceptGraph` section, with the Cypher that finds the class thread.

**Where it reaches.**
- **Every install.** Today's install's pass 1c calls the route for the manifest's existing nodes, so every install rewrites the concept graphs of `node-type`, `graph-type` and `validation-tool-type` this way (story 37's test plan, oracle SO6).
- **Every reader that matches by slug.** The Tapestries UI's `composeGraph`, the I/O import and import nostr's `claimsOf` match a relationship's ends by slug through `graph.nodes`, so they find nothing in such a graph.
- **Graph imports.** Import nostr, given such a graph's address, can't follow imports it no longer lists.

**What doesn't do it.** `lifecycle seed-firmware` keeps the form create-concept gives these three concept graphs (ADR graph-operations-first-slice/0037, Amendment 1). On an instance today's install set up, seed-firmware reports them `kept` until taken.

**Fix shape.** Have the route merge the elements it means to list into the concept graph's existing JSON, rather than replace it, or stop rewriting it at all. A concept graph doesn't list a class thread's sets and elements anyway: its Cypher finds them. Under D15 the old route may simply retire with today's install.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0037-seed-firmware.md` (Amendment 1, item 2); `engineering-team/stories/graph-operations-first-slice/37-seed-firmware.test-plan.md` ("Settled at Test Design", item 2).
