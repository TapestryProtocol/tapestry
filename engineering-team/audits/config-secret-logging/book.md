# Book of Work: The config reader stops logging secret values

**Slug:** config-secret-logging
**Status:** Open
**Opened:** 2026-10-31
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the owner's ask (2026-10-31, fix ngit issue `c549202b` from start to finish), restated:

### Acceptance frame

- [ ] `getConfigFromFile()` logs a key's name and whether it was found, never its value, for every way it resolves a
      key (quoted, unquoted, the `source` fallback, the default).
- [ ] A stack-free unit test proves it and fails on the code before the fix.
- [ ] A throwaway instance's startup log shows no `NEO4J_PASSWORD` or `SESSION_SECRET` value.
- [ ] The fix is on ngit `staging` and deployed to the staging droplet, whose startup log shows no values.
- [ ] Issue `c549202b` carries the commit and the staging evidence, and is marked resolved.
- [ ] *(Added 2026-10-31 for story 10, the follow-up from story 9's review; narrowed at its review.)* The five readers
      story 10 names (`src/utils/config.js`, `lib/config.js`, `addToQueue.mjs`, `publish_nip85_30382.js`,
      `personalizedGrapeRank/initializeScorecards.js`) keep bash's stderr and values out of the log, and
      `addToQueue.mjs` logs names, never values. The 11 GrapeRank scripts and the shell scripts with the same pattern
      are queued in `stories/_intake.md`, not part of this book.

## Epics in this book
- `security-auth-exposure` — story 9, the config reader logs key names, never values; story 10, sourcing the config
  file never puts its contents in a log.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/config-secret-logging/audit.md`
- Product feedback: `engineering-team/audits/config-secret-logging/prd-seed.md`
