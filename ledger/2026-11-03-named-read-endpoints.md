# The public UI reads the graph through open Cypher; named read endpoints would close the class

**Id:** 2026-11-03-named-read-endpoints
**Type:** feature
**Opened:** 2026-11-03 (security-auth-exposure #12, book `neo4j-query-public-reads`)
**Status:** OPEN
**Done:** —

`POST /api/neo4j/query` accepts any Cypher from anyone and story 12 filters it by plan. A plan filter keeps finding
gaps: review 12's round 1 found two (calls nested in expressions, admin commands). The UI's public uses are a known,
small set (`ui/src/api/conceptMembers.js`, `hooks/useNeo4jLabels.js`, `pages/Dashboard.jsx`, `events/DListItemRatings.jsx`,
`io/ExportPage.jsx`, `lists/DListRatings.jsx`, `settings/ConceptMembersView.jsx`, `settings/DatabaseSettings.jsx`,
`users/Index.jsx`, `utils/conceptCounts.js`, and the `public/kg` bundle). Give each a named, parameterised read
endpoint, then make the open endpoint owner-only.

A feature-sized change across the UI: worth a story and an ADR, not a hotfix.

**Pointer:** review 12, follow-ups.
