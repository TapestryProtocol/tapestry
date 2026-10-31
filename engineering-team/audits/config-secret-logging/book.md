# Book of Work: The config reader stops logging secret values

**Slug:** config-secret-logging
**Status:** Open
**Opened:** 2026-10-31
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the owner's ask (2026-10-31, fix ngit issue `c549202b` from start to finish), restated:

### Acceptance frame

- [x] `getConfigFromFile()` logs a key's name and whether it was found, never its value, for every way it resolves a
      key (quoted, unquoted, the `source` fallback, the default). *(Story 9, fix `b56f83a1`.)*
- [x] A stack-free unit test proves it and fails on the code before the fix. *(`test/config-secret-logging.test.js`:
      0/5 at `ff1e4569`, 5/5 after.)*
- [x] A throwaway instance's startup log shows no `NEO4J_PASSWORD` or `SESSION_SECRET` value. *(Review 9, AC-5.)*
- [x] The fix is on ngit `staging` and deployed to the staging droplet, whose startup log shows no values. *(Merge
      `6d3bb659`, deploy run 41235569192; review 9, AC-5.)*
- [x] Issue `c549202b` carries the commit and the staging evidence, and is marked resolved. *(Zeus's comment
      2026-10-31 20:14 UTC; status `applied`.)*
- [x] *(Added 2026-10-31 for story 10, the follow-up from story 9's review; narrowed at its review.)* The five readers
      story 10 names (`src/utils/config.js`, `lib/config.js`, `addToQueue.mjs`, `publish_nip85_30382.js`,
      `personalizedGrapeRank/initializeScorecards.js`) keep bash's stderr and values out of the log, and
      `addToQueue.mjs` logs names, never values. The 11 GrapeRank scripts and the shell scripts with the same pattern
      are queued in `stories/_intake.md`, not part of this book. *(Story 10, fix `a6b73119`, merge `17e38803`, deploy
      run 41243255175: all five patched readers present on the droplet, 0 values and 0 failed lookups in its logs.)*

## Epics in this book
- `security-auth-exposure` — story 9, the config reader logs key names, never values; story 10, sourcing the config
  file never puts its contents in a log.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/config-secret-logging/audit.md`
- Product feedback: `engineering-team/audits/config-secret-logging/prd-seed.md`
