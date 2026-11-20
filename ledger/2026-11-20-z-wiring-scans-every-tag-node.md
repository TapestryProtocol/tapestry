# import nostr's `z` wiring scans every tag node, since tag values have no index

**Id:** 2026-11-20-z-wiring-scans-every-tag-node
**Type:** cleanup
**Opened:** 2026-11-20 (story graph-operations-first-slice #32, `import nostr`, its live check)
**Status:** OPEN
**Done:** —

**What was seen.**
- **What the wiring does:** when an import makes an `IS_THE_CONCEPT_FOR`, from a graph or a relationship letter, it gives the superset a `HAS_ELEMENT` to every node whose `z` tag names the header (ADR graph-operations-first-slice/0032, Decision 8).
- **The scan:** the statement (`WIRE` in `src/operations/catalog/import/_letters.js`) matches `(:NostrEventTag {type: 'z', value: $header})`. `EXPLAIN` on a scratch stack shows a `NodeByLabelScan` of every `NostrEventTag` (7,685 there), then a filter.
- **Why it scans:** `NostrEventTag` has no index beyond its `uuid` rule. ADRs 0019 and 0028 note the same for other reads, and `wire-implicit-elements`, whose query the wiring follows, has the same match (`src/api/normalize/index.js`).
- **The cost:** a concept graph's import runs the scan twice, once for its own `IS_THE_CONCEPT_FOR` and once for its core nodes graph's. At memo #129's scale (50,000 letters, about 300,000 tag nodes) each run reads them all.

**What closes it.** One of:
- an index Neo4j can seek for a tag's type and value, added to `setup/neo4jConstraintsAndIndexes.sh` and to `expectedNeo4jSchema.js`;
- a measurement on a large instance showing the scan is cheap enough there.

**Pointer:** `src/operations/catalog/import/_letters.js` (`WIRE`); story graph-operations-first-slice #32 § Evidence; ADR graph-operations-first-slice/0032, Decision 8.
