# Story 12: A public /api/neo4j/query is a plain read of the graph

**Status:** Done
**Created:** 2026-11-02
**Type:** Bug (security / server-side request forgery and admin reach)
**Epic:** `security-auth-exposure`
**Book:** `audits/neo4j-query-public-reads/`
**Source:** found live on 2026-11-02 while checking whether `/api/neo4j/query` was a risk. Shipped as an owner-approved
hotfix and recorded afterwards (precedent: stories 4–8). Until it shipped, the hole was described, never named.

## Background

`POST /api/neo4j/query` is open to anyone for reads, because the browsing UI is built on it. Story 1 made public
queries read-only, and Neo4j enforces that itself (anonymous queries run in a READ session). But a read can reach
outside the graph:

- **`apoc.load.*` and `LOAD CSV` fetch URLs from inside the container.** `apoc.load.*` is on the Dockerfile's procedure
  allowlist. The auth middleware treats a request from loopback with no forwarding header as the trusted local
  operator (`req.localTrusted`, ADR 0001). So `CALL apoc.load.json("http://127.0.0.1:7778/<route>")` let an anonymous
  caller read routes that need the owner (confirmed on `GET /api/auth/test`). `apoc.load.jsonParams` can POST, and
  the cloud metadata address `169.254.169.254` was reachable.
- **`dbms.*` procedures and most `SHOW` commands** read the server's configuration and users.
- **`TERMINATE TRANSACTIONS`** ran for anyone (found at review), so a caller could kill the owner's imports and
  firmware installs.

Confirmed on staging and production (the procedure list), and end to end on a local instance, 2026-11-02.

## User-facing description

As the owner of a Brainstorm instance, I want anonymous queries to my graph to stay plain reads, so that nobody can use
my server to fetch URLs, reach my owner-only routes, read its configuration, or cancel its work, while the public pages
keep working.

## Acceptance criteria

- [x] **AC-1 A public query is planned before it runs.** For a caller who is neither the owner's side nor direct-local,
      the handler asks Neo4j for the plan (EXPLAIN) and runs the query only if the plan is a plain read. A query with
      no plan, or one that doesn't plan, never runs.
- [x] **AC-2 Reaching outside the graph is refused (403).** `LOAD CSV`; any procedure other than `db.labels`,
      `db.relationshipTypes`, `db.propertyKeys`; any `SHOW` other than constraints and indexes; anything on the
      `system` database; and the administrative operator families (`TERMINATE TRANSACTIONS` and the like). Calls and
      loads nested inside an expression (`COLLECT { }` in a list comprehension or `CASE`) are refused too.
- [x] **AC-3 Neo4j won't fetch internal addresses.** `internal.dbms.cypher_ip_blocklist` refuses loopback, link-local
      (cloud metadata), private, carrier-grade NAT and IPv6-local ranges for `LOAD CSV` and `apoc.load.*`, in the
      Docker image and the non-Docker installer. `file:///` imports keep working.
- [x] **AC-4 Nothing the UI sends is refused.** Plain reads, `CALL db.labels()`, the Dashboard's `SHOW CONSTRAINTS` and
      `SHOW INDEXES`, and nested reads such as `COLLECT { MATCH … }` and `COUNT { }` still return data.
- [x] **AC-5 The owner's side and direct-local callers are unchanged,** and pay no EXPLAIN round trip.

## Concepts touched

None.

## Out of scope (follow-ups, filed in OPEN.md)

- A time limit for public reads (an expensive read can still keep Neo4j busy).
- Named read endpoints in place of open Cypher.
- Retiring "loopback with no forwarding header means the owner" (`src/middleware/auth.js`), the trust that made a
  server-side fetch owner-grade.
- Re-running the live planner tests on every Neo4j upgrade, since a new admin operator family would pass by default.

## Phase path

Bug, Standard strictness. Shipped as an owner-approved hotfix: Architecture skipped as obvious, tests written before
the fix, two review rounds (round 1 found two bypasses, fixed in round 2), then staging, production, `feat/tags` and
`feature-magic-carpet`, each step on the owner's OK. Story, test plan and review were written after shipping.

## Linked artifacts
- Test plan: `stories/security-auth-exposure/12-public-query-plain-reads.test-plan.md`
- Review: `reviews/security-auth-exposure/12-public-query-plain-reads.md`
- Fix: `10ad7b7f1`, review round 1 `f618886da`
