# `setup-alert-polish` S2 fails on staging: the /reading views' `writeVerbs.js` POSTs to `/api/strfry/publish` by hand

**Id:** 2026-11-07-reading-writeverbs-raw-publish
**Type:** bug
**Opened:** 2026-11-07 (openapi-coverage ship to staging, CI on nousclawds4/tapestry#28)
**Status:** OPEN
**Done:** —

`test/setup-alert-polish.test.js` S2 (ADR setup-status-and-alert/0003 § 7) fails on GitHub `staging` since Vinney
Cavallo's reading-views commit `8a0b78e0d` (PR #26) added `ui/src/pages/reading/writeVerbs.js`, which POSTs to
`/api/strfry/publish` by hand (`writeVerbs.js:278`, `signAs: 'assistant'`). S2 says: a page that can publish the viewer's
kind 3 or kind 10040 must go through `publishToLocalStrfry`, so the Setup Alert re-checks; any other page goes on
`RAW_PUBLISH_ALLOWED` with the kinds it publishes. Seen in CI run 42341720463 on PR #28 (6674 passed, 1 failed), and
locally on `staging` alone (`7acc2df6b`, 16 passed, 1 failed), while the openapi-coverage branch without the reading
views passes it 17/17. Until it's fixed, every PR into `staging` reads red on this one test.

Fix shape (the reading views' owner's call): `writeVerbs.js` republishes concept-graph events signed as the Assistant,
so it looks unable to carry the viewer's own kind 3 or 10040. If so, add `'pages/reading/writeVerbs.js'` to
`RAW_PUBLISH_ALLOWED` in `test/setup-alert-polish.test.js` with the kinds it publishes; otherwise route it through
`publishToLocalStrfry`.

**Pointer:** `engineering-team/audits/openapi-coverage/audit.md` (the book shipped with this red, on the owner's OK)
