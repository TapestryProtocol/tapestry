# Review: Story 12 — A public /api/neo4j/query is a plain read of the graph

**Reviewer:** Claude (acting as Reviewer, a subagent separate from the author)
**Date:** 2026-11-02 (round 1 and round 2); filed 2026-11-03 after the fix shipped
**Diff:** round 1 `10ad7b7f1`, round 2 `f618886da`, on `fix/neo4j-query-hardening` (base `origin/staging` `cc60c9474`)
**Story:** `engineering-team/stories/security-auth-exposure/12-public-query-plain-reads.md`
**Test plan:** `engineering-team/stories/security-auth-exposure/12-public-query-plain-reads.test-plan.md`
**ADR:** none (Bug, Standard; Architecture skipped as obvious)
**Book:** `engineering-team/audits/neo4j-query-public-reads/book.md`
**Confidentiality:** an unshipped security hotfix while reviewed, so this review was kept outside the repo and written
against the brief and the commit messages, until the fix was in production (precedent: stories 4–8). Filed unchanged
below, apart from this header.

## Quality gates (run by reviewer, not trusted)

- [x] `test/neo4j-query-public-reads.test.js` (with the L-class against the throwaway Neo4j 5.26.10 community + APOC probe): **22 passed, 0 failed, 0 skipped**.
- [x] `test/close-unauth-write-surface.test.js` (its stub changed): **14 passed, 0 failed, 0 skipped**.
- [ ] Full `npm test` / `npm run gate:status`: **not run**, on purpose. The owner's standing rule on the Mac Studio is not to run the full suite, and this brief says the same. There is no gate:status line to quote.
- [ ] Playwright: not applicable (server-side change only).
- [ ] _Lint, typecheck and build are not configured, so they were skipped._
- [x] Dockerfile config: I booted a fresh `neo4j:5.26.10` with the **full** ten-range blocklist value. Strict validation is on by default. It started, the line is in `neo4j.conf`, and LOAD CSV to 172.17.0.3, `[fe80::1]` and 100.64.0.1 was refused by `internal.dbms.cypher_ip_blocklist`. The author's own probe has only two ranges, so this is new evidence that the full string parses.

## Spec adherence
- [x] Top-level `LOAD CSV`, procedure calls outside the three allowed ones, and `Show*` other than constraints and indexes are refused for public callers. Verified live.
- [ ] **The claim "nesting can't hide a call" (queryPost.js:29, and the commit message) is false.** See Blocking 1.
- [ ] **"A plain read of the graph" is not met.** `TERMINATE TRANSACTIONS` and system administration commands still run for anonymous callers. See Blocking 2.
- [x] Owner and `localTrusted` paths are unchanged and skip the EXPLAIN (U-tested).
- [x] UI regression: `ui/src` and the built `public/kg/assets` bundle send only `CALL db.labels()` (useNeo4jLabels.js:33), `SHOW CONSTRAINTS …` (Dashboard.jsx:249) and `SHOW INDEXES …` (Dashboard.jsx:258) beyond plain MATCH reads. All three plan to allowed operators and pass live. `src/firmware/install.js:90` goes through the internal bridge (`localTrusted`), so it is unaffected. Nothing the UI sends is wrongly refused.

## ADR adherence
- [x] Small diff: handler, driver helper, two config files and tests. No new dependencies or tooling.
- [x] Layering: the plan helper is in `src/lib/neo4j-driver.js` and the policy is in the handler. Fine.

## Concept-graph integrity
- [x] No concept definitions touched. No firmware reinstall needed.

## Things tests can't catch
- [x] No secrets, no debug logging, no commented-out code.
- [x] EXPLAIN round trip: params are passed through unchanged. `'EXPLAIN ' + cypher` behaves correctly with `CYPHER 5 …` and `CYPHER runtime=… …` prefixes, which I verified. A query already starting with EXPLAIN or PROFILE fails to plan and nothing runs. Planner errors fall into the existing `catch` (200, `success:false`), the same as before.
- [ ] Security: two bypasses, below.
- [x] Redirect-to-loopback (the author's inconclusive test): **verified closed.** I put a 302 redirector on a non-blocked docker-bridge IP that pointed at `http://127.0.0.1:7474/`. `apoc.load.json`, `apoc.load.jsonParams` (POST), `apoc.load.xml` and `LOAD CSV` all followed it and were refused at the redirect target. Also refused: `[::ffff:127.0.0.1]` (IPv4-mapped), `127.1` and `0x7f000001`. `0177.0.0.1` parses as public 177.0.0.1. `apoc.load.jsonArray` and `apoc.load.arrow` honour the blocklist too.
- [x] Docker image: the conf is baked into the image, not stored on the data volume, so a rebuild applies it to existing deployments. `setup/install-neo4j.sh` deletes the line before re-adding it, so re-runs are safe. All in-repo `apoc.load.json` uses are `file:///`.

## House rules check
- [x] Concept Graph API authority respected (not touched).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

1. **src/api/neo4j/queryPost.js:31-46 (high): procedure calls and LOAD CSV nested in an expression are not in `children`, so the walker never sees them.** When the planner cannot un-nest a `COLLECT {…}` subquery (inside a list comprehension or a `CASE`), it keeps the whole subquery as an expression in the parent operator's `Details` string, for example `Projection | "[x IN $autolist_1 | COLLECT { ResolvedCall(dbms.listConfig(...)) ... }]"`. There is no `ProcedureCall` child. Verified live through the real `queryPost` + `explainCypher` against the probe, as an anonymous caller:
   - `RETURN [x IN [1] | COLLECT { CALL dbms.listConfig() YIELD name, value RETURN name + '=' + value }] AS y` returns **200 `success:true` with the full server config**.
   - `RETURN [x IN [1] | COLLECT { CALL apoc.load.json('http://127.0.0.1:1/x') YIELD value RETURN value }] AS y` passes the gate and **runs**. Only the blocklist stopped it (`URLAccessValidationError`).
   - `WITH 1 AS a RETURN CASE WHEN a=1 THEN COLLECT { CALL apoc.load.json(…) … } END AS y` behaves the same.
   - `RETURN [x IN [1] | COLLECT { LOAD CSV FROM 'http://127.0.0.1:1/x' AS r RETURN r }] AS y` passes the gate and runs. Only the blocklist stopped it.

   So the "primary control" is bypassed for every READ-mode procedure (all of `apoc.load.*`, `dbms.*`, any READ-mode `gds.*`) and for LOAD CSV. An anonymous caller can still make the server fetch any **public-internet** URL (SSRF/proxy, blind exfil, GET and POST via `jsonParams`). Loopback and metadata now rest on the blocklist alone, which this commit calls the second layer. Neo4j itself rejects WRITE-mode procedures inside COLLECT ("cannot contain any updates"), so `apoc.periodic.submit/iterate` did **not** get through this way. I tested that.
   Detail strings are not truncated: a 16 KB Details string still contained the full `ResolvedCall(...)`, so a text check on Details is reliable.
   **Asked change:** for every plan node, scan all string values in `node.arguments` (at least `Details`). Refuse if any contains `ResolvedCall(` or `LOAD CSV`, or extract the procedure names from `ResolvedCall(<name>(` and apply `PUBLIC_PROCEDURES`. Refusing outright is simpler and fails closed. The UI never nests `db.labels`. Add the four queries above as U-class cases using the real plan shapes, and as L-class cases.

2. **src/api/neo4j/queryPost.js:36-44 (medium-high): `TERMINATE TRANSACTIONS` and system administration commands pass the walker.** The plan is `TerminateTransactions@neo4j` or `AdministrationCommand@system`. Neither is a `Show*`, `ProcedureCall` or `LoadCSV`, and none of `WRITE_KEYWORDS` match. Verified live: I started a long transaction in a separate cypher-shell session, then sent `TERMINATE TRANSACTIONS [i IN range(210,220) | 'neo4j-transaction-' + toString(i)]` as an anonymous caller. It returned 200 and **killed the other session's transaction** ("Explicitly terminated by the user"). Transaction IDs are sequential, so a public caller can repeatedly kill the owner's imports, reconciliation and firmware installs. That is an owner-grade effect. `SHOW USERS`, `SHOW CURRENT USER` and `SHOW DATABASES` (`AdministrationCommand@system`) also return 200 and leak the DB user and database layout. This predates the commit, but it is exactly what the commit says it closes ("a public /api/neo4j/query is a plain read of the graph"). `STOP DATABASE` is unsupported on community, which I verified.
   **Asked change:** refuse `TerminateTransactions` and any operator whose `@` suffix is `system` (or `AdministrationCommand*`). Better still, make the walker fail closed: build an allowlist of plain-read operator families, or at least refuse operator types it does not recognise in the "command" families. Add U and L cases.

### Non-blocking

1. **src/api/neo4j/queryPost.js:32-35:** the walker fails open on a missing plan. `publicPlanRefusal(false|null)` returns `null` (allowed), and the JS driver uses `false` for "no plan". Every query I tried did return a plan, but the gate should refuse when the root plan is falsy.
2. **test/neo4j-query-public-reads.test.js:122-160, 232:** the U-class plans are hand-built, and the L-class runs only the same top-level shapes. Neither covers nested expressions or command operators, which is where both bypasses live. Once the fix lands, the L-class should cover the nested and TERMINATE cases (see Blocking 1 and 2).
3. Every public read now costs two Bolt round trips (EXPLAIN, then run). The plan cache keeps this cheap, so it is acceptable for a hotfix.
4. **DNS rebinding against the blocklist is untested.** Neo4j resolves the host to check it, and the HTTP client may resolve it again. This is one more reason Blocking 1 must be fixed rather than leaning on the blocklist.

### Agreed follow-ups (out of scope for the hotfix; file once shipped)
- A per-query timeout or row/memory cap for public reads (DoS through cartesian products, deep `range()` or gds projections).
- Replace the open Cypher endpoint with named read endpoints. A plan-walker denylist will keep finding gaps like the two above.
- Retire "loopback without X-Forwarded-For means owner" (`src/middleware/auth.js` `isDirectLocal`). That trust model is what made a server-side fetch owner-grade.

### Harness friction
1. The full-suite gate cannot be run on this machine under the owner's rule, so a hotfix review has no `gate:status` line to quote. The review template assumes one.

## Verdict
**CHANGES_REQUESTED**

Both blocking items are small, local fixes to `publicPlanRefusal` plus tests. The blocklist (second layer) is correct, parses under strict validation, and holds against redirects. Keep it as is.

---

# Round 2: commit f618886da

**Date:** 2026-11-02
**Diff:** `git show f618886da` (on top of 10ad7b7f1). HEAD = f618886da, working tree clean.
**Probe:** I checked that `neo4j-blocklist-probe` is still `neo4j:5.26.10` at 172.17.0.2 before using it.

## Quality gates (rerun by reviewer)
- [x] `test/neo4j-query-public-reads.test.js` with the L-class against the probe: **31 passed, 0 failed, 0 skipped**.
- [x] `test/close-unauth-write-surface.test.js`: **14 passed, 0 failed, 0 skipped**.
- [ ] Full `npm test` / `gate:status`: not run, same reason as round 1.

## Round-1 findings, checked as fresh claims

I re-derived each fix by running the real `queryPost` + `explainCypher` as an anonymous caller against the probe. I did not rely on the suite.

**B1 (nested calls): resolved.** Every one of these now returns **403**:
- a procedure call nested in `EXISTS {}` inside a list-comprehension `WHERE`
- `reduce(… | acc + COLLECT{…})`
- a map projection `n { .*, cfg: COLLECT{…} }` (planned as a child, refused as a procedure)
- `ORDER BY size([… | COLLECT{…}])`
- `WHERE size([… | COLLECT{…}])`
- `COUNT{}` and `EXISTS{}` inside a list comprehension
- a nested COLLECT behind `UNWIND` or behind `MATCH … WITH … LIMIT`
- a `UNION` branch carrying a nested call

Two more cases:
- `CALL (x) { … } IN TRANSACTIONS` is refused as `TransactionApply`. The old keyword check did not cover this scoped-subquery form.
- `CYPHER 25 …` cannot plan on 5.26 (only version 5 exists), so nothing runs.

**B2 (admin commands): resolved.** These now return 403:
- `TERMINATE TRANSACTIONS` (TerminateTransactions)
- `SHOW USERS` (AdministrationCommand@system)
- `SHOW SETTINGS`
- `SHOW TRANSACTIONS`

**Non-blocking 1 (missing plan): resolved.** A falsy plan is refused. There is a U test for it.

## Can the text scan refuse something legitimate?

**Literals.** User literals are auto-parameterized before they reach the plan text. A real UI query shape (the SetDetail.jsx:71-76 query with `EXISTS { MATCH … }`), with `'abc load csv ResolvedCall('` interpolated as the uuid, returns **200**. `WHERE n.name = 'load csv'` also returns 200.

**Plan argument values.** Across the plans I dumped, every argument value is either a string, a number, or a neo4j `Integer` (the `Id`). None is an object whose text `String()` would hide. The root also carries `string-representation`, the whole plan as text, so the scan has a second net.

**What the UI sends.** I re-grepped `ui/src` and the built bundle. Every procedure or SHOW the UI sends is one of the three from round 1, and all pass live:
- `CALL db.labels()`
- `SHOW CONSTRAINTS …` and `SHOW INDEXES … WHERE type <> 'LOOKUP'` (the exact Dashboard texts)

Other UI reads that also pass:
- `CALL db.propertyKeys()`
- nested reads: `COLLECT { MATCH … }` and `COUNT { (n)--() }`
- `apoc.coll.*` functions

The only subquery expression in the UI is `EXISTS { MATCH … }`, which is allowed.

**Effects without `ResolvedCall` text.** The only allowlisted functions are `apoc.coll.*`, and they are pure. No Neo4j built-in function fetches a URL. Write-mode procedures can't sit inside expression subqueries: Neo4j rejects them ("cannot contain any updates", round 1).

## Findings

### Blocking
None.

### Non-blocking
1. **src/api/neo4j/queryPost.js `ADMIN_OPERATORS`:** I accept a family denylist over a full operator allowlist for a hotfix. The backstops are the procedure allowlist, the `@system` refusal and the argument-text scan, and an incomplete allowlist would break UI reads. The risk is a **Neo4j upgrade**: a new command operator family in a future version would pass by default. Suggested follow-up: on any Neo4j version bump, re-run this suite's L-class against the new planner, and record that in the upgrade checklist.
2. **`db.labels` nested inside an expression is now refused** (the text scan catches every `ResolvedCall`). The UI never does this, so the over-refusal fails closed and is harmless.
3. Round-1 follow-ups stand:
   - a per-query timeout for public reads
   - named endpoints instead of open Cypher
   - retiring the loopback-means-owner trust in `src/middleware/auth.js`
   - DNS rebinding against the blocklist is still untested

## Verdict (Round 2)
**PASS**

The story-file status flip and the review commit were deferred until the fix shipped, per the confidentiality instruction.
