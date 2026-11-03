# "Loopback with no forwarding header means the owner" turns any server-side fetch into owner access

**Id:** 2026-11-03-retire-loopback-means-owner
**Type:** bug
**Opened:** 2026-11-03 (security-auth-exposure #12, book `neo4j-query-public-reads`)
**Status:** OPEN
**Done:** —

`src/middleware/auth.js` (`isDirectLocal`, ADR security-auth-exposure/0001) trusts a request whose socket peer is
loopback and which carries no `X-Forwarded-For` as the local operator. Anything inside the container that can be made
to send an HTTP request (story 12's `apoc.load.*` was one; a future URL-fetching feature could be another) therefore
reaches owner-only routes. Story 12 closed that path and Neo4j's IP blocklist backs it, but the trust remains.

Fix shape: give the trusted local callers (the firmware-install bridge, the loopback task scripts, the CLI) an explicit
credential (a per-boot secret file only they can read, or a unix socket), and stop trusting the peer address alone.
Needs an ADR; it touches every caller ADR 0001/0002 lists.

**Pointer:** `src/middleware/auth.js`; review 12, follow-ups.
