# The session-start digest calls whatever answers on :7778 "the stack", and on the Mac Studio that's Grawk's private agent memory

**Id:** 2026-11-03-session-digest-trusts-any-7778
**Type:** meta
**Opened:** 2026-11-03 (book `neo4j-query-public-reads` close, retro)
**Status:** OPEN
**Done:** —

`scripts/session-start.sh` prints "stack present at :7778 — concept-graph API answering; AGENTS.md §1–§3 orientation
applies" whenever the concept-graph API answers. Since 2026-10-29 :7778 on the Mac Studio is Grawk's private
agent-memory instance (container `tapestry`, compose project `agent-memory`), not a dev stack. During story 12's
investigation a session took the digest at its word and sent read-only probe queries there, including one that
fetched an owner-only route through Neo4j. Nothing changed, but the probes should have gone to a throwaway instance.

Fix shape: have the digest read `docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' tapestry`
and, for anything other than the dev stack's project, print "a Tapestry answers on :7778 but it is not the dev stack
(project <name>): hands off" instead. Sibling of row `2026-10-31-stack-free-guard-suite-calls-7778`.

**Pointer:** `scripts/session-start.sh`; `engineering-team/audits/neo4j-query-public-reads/audit.md` §7.
