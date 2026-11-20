# A scratch stack boots with none of the uniqueness rules a set-up instance has, so a live check of a race on it tests a schema no real instance runs

**Id:** 2026-11-20-scratch-stack-lacks-uniqueness-rules
**Type:** meta
**Opened:** 2026-11-20 (story graph-operations-first-slice #32, `import nostr`, its live check)
**Status:** OPEN
**Done:** —

**What was seen.** `scripts/scratch-stack.sh up` gave a Neo4j that held one constraint, `tags_address`, which the control panel creates at boot.
- **Missing:** the rules the Dashboard's fix makes (`POST /api/neo4j-setup-constraints-and-indexes`, which runs `setup/neo4jConstraintsAndIndexes.sh`). These are `nostrEvent_id`, `nostrEvent_uuid`, `nostrEventTag_uuid`, `nostrUser_pubkey` and the rest of `src/api/status/queries/expectedNeo4jSchema.js`'s list. Also missing: `tapestry_key`, which `lifecycle migrate --migration tapestry-keys` makes.
- **Why:** the script installs firmware through the API, past the Dashboard's wait for those rules.
- **What it broke:** on that schema, story 32's LV3 (two imports of one new event at once) left two nodes for one event, which the rules would have refused. With the rules applied, LV3 and ten more races each left one node (story 32 § Evidence, the live check).

**Why it matters.** A live check that relies on a uniqueness rule runs on a schema no set-up instance has. Examples are import nostr's one node per event, or any `MERGE` or `CREATE` under concurrency. Such a check either fails for that reason, or passes for the wrong one.

**What closes it.** `up` applies the rules before it installs firmware:
1. The Dashboard's fix, through the container's loopback.
2. `tapestry lifecycle migrate --migration tapestry-keys`.
3. A check that `SHOW CONSTRAINTS` holds `expectedNeo4jSchema.js`'s list and `tapestry_key`.

Story 32's `tmp/live-check-32/setup.sh` (in the main checkout) does this after `up`.

**Pointer:** `scripts/scratch-stack.sh` (`up`); story graph-operations-first-slice #32 § Evidence; `src/api/neo4j/commands/setupConstraintsAndIndexes.js`; OPERATIONS.md §17.
