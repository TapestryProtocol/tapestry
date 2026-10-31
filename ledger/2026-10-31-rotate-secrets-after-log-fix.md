# Rotate SESSION_SECRET and NEO4J_PASSWORD wherever old startup logs may hold them

**Id:** 2026-10-31-rotate-secrets-after-log-fix
**Type:** cleanup
**Opened:** 2026-10-31 (book `config-secret-logging`, ngit issue `c549202b`)
**Status:** OPEN
**Done:** —

Until stories `security-auth-exposure` #9 and #10, every app start wrote `NEO4J_PASSWORD` and `SESSION_SECRET` to
`/var/log/supervisor/brainstorm.log`. Logs copied or kept from before the fix may still hold them. Operational, the
owner's call per instance:

- **Staging** has the fix since 2026-10-31 (`6d3bb659`, then `17e38803`) and can be rotated now.
- **Production, `tags`, `magic-carpet` and the agent-memory instance** run `main`, which has neither fix. Promote
  first, then rotate, or the next restart logs the new values.

How: `SESSION_SECRET` — delete `/var/lib/brainstorm/session.secret` and restart; everyone is signed out (OPERATIONS.md
§9.6). `NEO4J_PASSWORD` — rotate through `docker exec tapestry cypher-shell … ALTER CURRENT USER SET PASSWORD`, set it
in `/opt/tapestry/.env`, restart (OPERATIONS.md §9.10). Also check whether any install's `brainstorm.conf` still holds
`BRAINSTORM_RELAY_PRIVKEY` or `BRAINSTORM_RELAY_NSEC`; the installer logged those the same way.

**Pointer:** `engineering-team/audits/config-secret-logging/audit.md` §6; ngit issue `c549202b`.
