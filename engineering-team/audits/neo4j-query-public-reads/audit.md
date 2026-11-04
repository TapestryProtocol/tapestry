# Build Audit: A public /api/neo4j/query is a plain read of the graph

**Book:** `engineering-team/audits/neo4j-query-public-reads/book.md`
**Date:** 2026-11-03
**Branch / commit range:** fix `10ad7b7f1` and review round 1 `f618886da` on `fix/neo4j-query-hardening` (base
`cc60c9474`); staging merge `586eaa38e`, production merge `78c840d23`, `feat/tags` cherry-picks `5406f4fed`,
`feature-magic-carpet` cherry-picks `08376328d`; records `224b8fbad` (staging `3eed1b8eb`, production `7527b4afd`).
This close lands on `main`.
**Provenance:** Acceptance-frame
**Confidence:** high. The frame is the owner's own question and go-ahead, every bullet has evidence, the fix was
reviewed by a separate Reviewer over two rounds, and it was checked live on all four instances as an anonymous caller
and on each droplet.

> The as-built record. It proposes nothing; `prd-seed.md` does that.

## 1. What shipped

- **A public query is planned before it runs.** For a caller who is neither the owner's side nor direct-local,
  `src/api/neo4j/queryPost.js` asks Neo4j for the plan (`explainCypher`, new in `src/lib/neo4j-driver.js`, EXPLAIN in
  a READ session) and runs the query only if `publicPlanRefusal` finds a plain read. — story 12, AC-1
- **Reaching outside the graph is refused (403).** `LOAD CSV`; procedures other than `db.labels`,
  `db.relationshipTypes`, `db.propertyKeys`; `SHOW` other than constraints and indexes; any step on the `system`
  database; the admin operator families (`TERMINATE TRANSACTIONS` and the like); and any step whose argument text
  carries `ResolvedCall(` or `LOAD CSV`, which is how a call nested in an expression appears. — story 12, AC-2
- **Neo4j refuses internal addresses.** `internal.dbms.cypher_ip_blocklist` (loopback, link-local, private,
  carrier-grade NAT, IPv6-local) in the `Dockerfile` and `setup/install-neo4j.sh`. — story 12, AC-3
- **The UI and the owner's side are unchanged.** Every query the UI sends still answers; the owner's side and
  direct-local callers skip the EXPLAIN. — story 12, AC-4, AC-5
- **Operators are told.** OPERATIONS.md §9.11, including a check to run after any Neo4j upgrade.

## 2. Epics & stories rolled up

### Epic: `security-auth-exposure`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #12 public-query-plain-reads | plan check on public queries, Neo4j IP blocklist | Done | `reviews/security-auth-exposure/12-public-query-plain-reads.md` (round 1 found two bypasses; round 2 passed) |

## 3. As-built inventory

- **User-facing:** no page changed. Anonymous queries that reach outside the graph now get 403 with
  "Public queries may only read the graph (… requires owner authentication)".
- **Domain:** no concept, handle, schema or firmware change. No reinstall.
- **Data & contracts:** `POST /api/neo4j/query` keeps its request and response shapes; a refused public query is a
  403 with `success:false`. One extra Bolt round trip (EXPLAIN) per public read.
- **Code:** `src/api/neo4j/queryPost.js`, `src/lib/neo4j-driver.js`, `Dockerfile`, `setup/install-neo4j.sh`, a new
  suite `test/neo4j-query-public-reads.test.js` (31 tests: unit, source and an optional live class), story 1's suite
  stub, `test/registry.js`.
- **Diff walk:** every file in the fix commits and the records commit traces to story 12, its test plan, its review,
  this book, the epic, OPERATIONS.md §9.11 or the ledger rows the review called for. The records commit also carried
  the separate firewall note (OPEN.md #66, `55983c9c5`), which belongs to the earlier `security-auth-exposure`
  companion task, not this book. No undocumented work.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | The fix proposed to the owner: refuse URL-loading for anonymous callers, plus a ~10 s time limit | No time limit | deferred | Some public pages run slow reads; a cap set without measuring could break them (story 12 *Out of scope*) | An expensive anonymous read can still keep Neo4j busy | §6 |
| 2 | Proposed check: refuse `LOAD CSV`, non-allowlisted procedures and `SHOW`s | Also refuses admin commands, the `system` database, nested calls and a missing plan | added-beyond-scope | Review 12 round 1 found both bypasses live | None for the UI; closes `TERMINATE TRANSACTIONS` and config reads | — |
| 3 | The ask: fix it | A family denylist for admin operators, not an allowlist of read operators | constraint-discovered | An incomplete read allowlist would break UI pages; review 12 round 2 accepted the denylist with the upgrade caveat | A Neo4j version adding a new admin operator would pass by default | §6 |
| 4 | Ship through the usual path | `feature-magic-carpet` deployed without a safe-to-merge verdict | constraint-discovered | Its build predates the endpoint; the owner approved after a read-only look | None seen | §6 |

**Undocumented work:** none.

## 5. Quality state at close

- **Test gate:** the full `npm test` was **not run**. On the Mac Studio it publishes fixtures to public relays (row
  `2026-09-27-test-fixture-taggings-on-prod-relays`), so there is no `gate:status` line. Substitute evidence, run in a
  throwaway `node:22-bookworm` container with the checkout read-only:
  - `neo4j-query-public-reads` 31/0 with its live class against a throwaway `neo4j:5.26.10` + APOC; 8/14 before the
    fix, and 23/8 against the round-0 check.
  - `close-unauth-write-surface` 14/0, `strfry-wipe-owner-gate` 3/0, `concept-count-canonical` 12/0 (7 skipped),
    `stack-free-npm-test` 6/0 (1 skipped). Both main suites re-run green on the merged staging tree and on each
    sandbox cherry-pick.
  - The Reviewer also proved the blocklist parses under strict validation with all ten ranges, and holds against a
    302 redirect to loopback and against `[::ffff:127.0.0.1]`, `127.1` and `0x7f000001`.
- **Live, on all four instances, as an anonymous caller:** `apoc.load.json` to loopback, `LOAD CSV`, nested
  `dbms.listConfig`, `TERMINATE TRANSACTIONS` and `SHOW USERS` get 403; plain reads, `db.labels()`, `SHOW CONSTRAINTS`
  and `SHOW INDEXES` return data. On each droplet (read-only) the blocklist line is present and Neo4j refuses a
  loopback fetch even for the trusted local caller; all supervisor programs are running.
- **harness-lint:** clean (0 violations).
- **ADR debt:** none (Bug, Architecture skipped as obvious).

## 6. Carry-forward register

- [ ] A time limit for public reads. (row `2026-11-03-public-query-timeout`)
- [ ] Named read endpoints in place of open Cypher, then make the open endpoint owner-only. (row
      `2026-11-03-named-read-endpoints`)
- [ ] Retire "loopback with no forwarding header means the owner". (row `2026-11-03-retire-loopback-means-owner`)
- [ ] Re-run the live planner tests on every Neo4j upgrade. (row `2026-11-03-neo4j-upgrade-plan-tests`)
- [ ] Grawk's agent-memory instance on the Mac Studio runs an older `main` and lacks the fix until rebuilt
      (LAN-only).
- [ ] DNS rebinding against the blocklist is untested; the endpoint check is the primary control. (review 12)

## 7. Process findings (harness)

`bash scripts/harness-stats.sh` at retro time: 310 reviews decided, kick-back rate 0%, churn 3; 9 open books and 89
closed before this close; this book open 1 day. Review 12's "Harness friction" section reported one item (P2).

| Finding | Source | Terminal state |
|---|---|---|
| P1. The first fix passed its own 22 tests and was still bypassable twice: the hand-built plans and the live class covered only top-level shapes. An adversarial Reviewer with a live probe found both in one round. | review 12, round 1 | declined: the per-story cycle worked as designed (tests first, independent review, fix, re-review); the structural answer is product-side, row `2026-11-03-named-read-endpoints` |
| P2. The review template assumes a `gate:status` line, which this machine can't produce. | review 12 § Harness friction | OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays` (the cause; still open) |
| P3. The session-start digest called :7778 "the stack"; it is Grawk's agent memory, and read-only probes went there before the session checked. | this session | OPEN.md row `2026-11-03-session-digest-trusts-any-7778` |
| P4. The "ship first, record after, describe without naming" lane for live security holes is written nowhere but an epic parenthesis. | this session (stories 4–8, 12) | OPEN.md row `2026-11-03-security-hotfix-record-after` |
| P5. The safe-to-merge check can't answer on a sandbox built before its endpoint. | this session (magic-carpet) | OPEN.md row `2026-11-03-safe-check-predates-endpoint` |
| P6. Suites ran without `node_modules` on the host; a read-only checkout plus a dependency volume worked, and two suites with no `require.main` block exited 0 silently until called through `run()`. | this session | OPEN.md row `2026-10-31-scratch-stack-image-and-lib-mount` ("Seen again 2026-11-02" added) |
| P7. zsh's `$b:refs` history modifier mangled a ref name in a loop. | this session | declined: already in agent memory (`zsh-modifier-mangles-handles`); caught at once |
| P8. Claude Code's permission check blocked a docs-only production push until the owner approved it. | this session | declined: the check worked as designed; production pushes need a fresh OK |

Ports to the other flow: P3 and P6 apply to any session on this machine in either flow; P4 applies to a Director too
(a Direction-mode book must not commit a hole's description before production has the fix); P5 to any deploy.

## 8. Epic close-out

`security-auth-exposure` stays **Done**. Story 12 joined it under this book as stories 3–11 did under theirs, and its
folders stay outside `done/`, as after the earlier closes.
