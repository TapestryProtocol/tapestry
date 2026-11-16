# The admin list holds "" on an instance with no admins: the conf reader returns an empty quoted value as two quote marks

**Id:** 2026-11-08-admin-list-empty-quotes
**Type:** bug
**Opened:** 2026-11-08 (graph-operations-foundation #2's live check, Loom A10.2)
**Status:** OPEN
**Done:** —

On a fresh Docker instance with no `ADMIN_PUBKEYS`, the entrypoint renders `export BRAINSTORM_ADMIN_PUBKEYS=""`. `getConfigFromFile` (`src/utils/config.js`) tries its quoted pattern first. The empty capture is falsy, so it falls through to the unquoted pattern, which matches the two characters `""`. `getAdminPubkeys()` then returns `['""']`. No session pubkey can equal it, so nobody gains access, but every reader of the list sees a bogus entry. `lifecycle backup` recorded it until A10.2 filtered the list to real pubkeys (`src/operations/catalog/lifecycle/_identity.js`, test B19). The fix shape is to return an empty quoted value as empty in `getConfigFromFile`; it has many callers, so the change needs its own story and suites.

**Pointer:** `src/utils/config.js` `getConfigFromFile` and `getAdminPubkeys`; `engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md` § Deviations.
