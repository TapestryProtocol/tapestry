# CustomerManager's locked writes check and rewrite a customer list it may have cached before taking the lock, so concurrent writers can silently drop records

**Id:** 2026-11-05-customer-manager-stale-cache-writes
**Type:** bug
**Opened:** 2026-11-05 (setup-create-account #2, Test Design)
**Status:** OPEN
**Done:** —

`src/utils/customerManager.js` keeps a 30-second per-instance cache of the whole customer list
(`getAllCustomers`, `:51-58`). Each locked write takes `customers.json`'s file lock, reads the list through
that cache, changes it, writes the whole file, and only then clears the cache. When the same instance read
the list before locking, the write works from a stale copy. A concurrent writer's change is overwritten,
and nothing reports it.

**Seen:** setup-create-account #2's test H7. Two concurrent sign-ups both returned 200, and one record
vanished. Test H12 isolates it: on staging-era code, two `createCustomer` calls for one pubkey, each on
an instance that had read the list first, both succeed.

**Fixed for `createCustomer` only** by setup-create-account ADR 0002 Amendment 1, which clears the cache
under the lock.

**Still open:** the other locked writers follow the same pattern: `:245`, `:309`, `:384`, `:473`, `:980`,
`:1195`. That covers updates, status changes, deletes and restores. Any caller that reads first on the same
instance, as the owner's customer pages do, can lose a concurrent change.

**Fix shape:** clear (or bypass) the cache right after each `lockfile.lock(...)`, or give
`getAllCustomers` a `{ fresh: true }` option that every locked writer uses. Add a test like H12 for each
writer.

**Pointer:** `engineering-team/decisions/setup-create-account/0002-open-sign-up-an-owner-only-setting.md`
§ Amendment 1; `test/setup-open-sign-up.test.js` H12.
