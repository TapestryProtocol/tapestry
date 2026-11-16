# Book of Work: A public /api/neo4j/query is a plain read of the graph

**Slug:** neo4j-query-public-reads
**Status:** Closed
**Opened:** 2026-11-02
**Closed:** 2026-11-03
**Gating:** **Human-gated.** A live security hotfix; the owner approved each step (fix, staging, production, each
sandbox). No Direction mode.

## Intent anchor

**Acceptance frame (no PRD)**: the owner's question of 2026-11-02, "I was told that the `/api/neo4j/query` endpoint is
a security risk. Is that true? If so, what should we do about it?", and, after the answer (yes: anonymous reads could
make the server fetch URLs as the trusted local operator), "Yes, fix it now". Shipped as a hotfix and recorded after,
as stories 4–8 were. Completion is *judged* against the bullets below.

### Acceptance frame

- [x] An anonymous caller can't make the server fetch a URL, reach an owner-only route through it, read the server's
      configuration or users, or terminate its transactions through `/api/neo4j/query`. *(Story 12, AC-1–AC-3.)*
- [x] The public pages keep working: every query the UI sends still answers. *(Story 12, AC-4; verified live on each
      instance.)*
- [x] The owner's side and direct-local callers are unchanged. *(Story 12, AC-5.)*
- [x] Reviewed by a reviewer separate from the author before anything was pushed. *(Review 12: round 1
      CHANGES_REQUESTED with two bypasses, round 2 PASS.)*
- [x] Shipped to staging, production, `feat/tags` and `feature-magic-carpet`, each on the owner's OK, and verified on
      each as an anonymous caller over the internet and on each droplet (read-only):
      - **staging:** merge `586eaa38e` (ngit, then GitHub), deploy run 41575698703, 2026-11-03.
      - **production:** merge `78c840d23`, deploy run 41579587818, 2026-11-03.
      - **tags:** cherry-picks `5406f4fed`, deploy run 41581491020, 2026-11-03.
      - **magic-carpet:** cherry-picks `08376328d`, deploy run 41586257296, 2026-11-03. Its build predates
        `/api/deploy-safety/status`, so the safe-to-merge check had no answer; deployed on the owner's explicit
        decision after a read-only look showed no task running.
- [x] What stays open is written down, not claimed fixed. *(OPEN.md rows below.)*

## What stays open

- `2026-11-03-public-query-timeout` — a time limit for public reads.
- `2026-11-03-named-read-endpoints` — named read endpoints in place of open Cypher.
- `2026-11-03-retire-loopback-means-owner` — the trust that made a server-side fetch owner-grade.
- `2026-11-03-neo4j-upgrade-plan-tests` — re-run the live planner tests on every Neo4j upgrade.
- Grawk's agent-memory instance on the Mac Studio runs an older `main` and doesn't have the fix until it's rebuilt.
  It's reachable on the LAN only.

## Epics in this book
- `security-auth-exposure` — story 12.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high

## Close artifacts
- Build audit: `engineering-team/audits/neo4j-query-public-reads/audit.md`
- Product feedback: `engineering-team/audits/neo4j-query-public-reads/prd-seed.md`
