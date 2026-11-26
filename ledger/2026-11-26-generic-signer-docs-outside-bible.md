# Outside the BIBLE, the generic signer's docs are behind: three test comments say an admin passes its owner gate, and openapi.yaml's schema leaves out `signAs` and names a field the route doesn't return

**Id:** 2026-11-26-generic-signer-docs-outside-bible
**Type:** docs
**Opened:** 2026-11-26 (doc-lane review `security-auth-exposure/bible-14-generic-signer-owner-only`, non-blocking findings N1 and N3)
**Status:** OPEN
**Done:** —

**What was seen.** Since 2026-10-11 the generic signer (`POST /api/strfry/publish` with `signAs: "assistant"`) signs as the TA only for the owner or a direct local call, and refuses an admin 403 through the handler's own owner check (security-auth-exposure ADR 0005, owner's decision 3; OPEN.md row 269). The doc-lane fix brought BIBLE §14 in line. Two other places still say otherwise:

- **Test comments.** `test/one-writer-assistant-profile.test.js:214`, `:218` and `:478–479` say an admin passes the generic signer's owner gate ("the owner gate is owner-or-admin", "isOwner is owner-or-admin"). The suite still passes, because the kind-0 refusal (`src/api/strfry/commands/publishEvent.js:50`) comes before the owner gate (`:61`), so the comments mislead a reader without breaking a check.
- **The API reference.** In `src/api/openapi.yaml`, the `/api/strfry/publish` request schema lists only `event` (`:3808–3809`), with no `signAs`. Its 403 text is right, but its 200 response lists `eventId` (`:3824`), while the handler answers `{ success, event, brainWrite? }` (`publishEvent.js:134`).

**Fix shape.** Correct the three comments to say an admin is refused at the owner gate, and that the kind-0 refusal comes first. In `openapi.yaml`, add `signAs` (`client` or `assistant`, with the owner-or-direct-local rule for `assistant`) to the request schema, and make the 200 response match the handler. Then run the suites that read `openapi.yaml`, `test/openapi-document.test.js` among them.

**Pointer:** `engineering-team/reviews/security-auth-exposure/bible-14-generic-signer-owner-only.md`, Findings N1 and N3.
