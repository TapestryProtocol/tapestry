# Deleting a customer answers 401 to everyone, because its handler reads a session field no login sets

**Id:** 2026-11-05-delete-customer-reads-stale-session-field
**Type:** bug
**Opened:** 2026-11-05 (setup-create-account #2, after its first review)
**Status:** OPEN
**Done:** —

`POST /api/delete-customer` (`src/api/index.js:422`, `OWNER_ACTION` at `src/middleware/routeAccess.js:181`) identifies
the caller by `req.session?.userPubkey` (`src/api/customers/deleteCustomer.js:33`). Since the sign-in rewrite
`37a31e247` (security-auth-exposure #3, 2026-09-11), a login sets only `authenticated` and `pubkey`
(`finalizeAuthenticatedSession`, `src/middleware/auth.js:50-58`). So the handler answers 401 "Authentication required"
to everyone, the owner included, and no customer can be deleted from the app. Its only caller is the legacy
manage-customer page.

`POST /api/change-customer-status` had the same bug. Story `setup-create-account` #2 fixes that one (ADR
`setup-create-account/0002` Amendment 2), because its AC-4 promises deactivation. Delete is left here: it removes a
customer's directory and keys, and no story promises it.

**A second problem, once the 401 is fixed.** The handler reads the customer list (`deleteCustomer.js:54`) through the
same `CustomerManager` instance whose `deleteCustomer` then takes the file lock and reads the list again
(`src/utils/customerManager.js:476`, `:491`). That second read comes from the 30-second cache, so a customer created
in between (an open sign-up, say) is lost when the cached list is written back. It is the pattern ledger row
`2026-11-05-customer-manager-stale-cache-writes` names.

**Fix shape.**
- Read the caller as `req.session.pubkey`, behind `req.session.authenticated === true`, keeping the owner-or-admin
  rule. Amendment 2's change-status fix is the model.
- Clear the instance's cache right after `deleteCustomer` takes its lock, as `createCustomer` does since Amendment 1.
- Test it through a deps seam with a real `CustomerManager` on a temp folder. Deleting is irreversible, so the tests
  must never reach `/var/lib/brainstorm`.

**Pointer:** `engineering-team/decisions/setup-create-account/0002-open-sign-up-an-owner-only-setting.md` § Amendment 2.
