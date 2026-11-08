# The suite screen used before a one-by-one run misses suites that hardcode a local URL, so one read from Grawk's instance

**Id:** 2026-11-08-suite-screen-misses-hardcoded-urls
**Type:** meta
**Opened:** 2026-11-08 (graph-operations-foundation #1, Loom A10.1: Implementation, and the review's Harness friction 1)
**Status:** OPEN
**Done:** —

Before running suites one by one on the Mac Studio, a session screens them for live calls. The screen greps for `docker exec`, `dockerCurl`, `execFileSync('docker'`, `TAPESTRY_PORT`, `TAPESTRY_CONTAINER`, `strfry/publish` and `nak`, and the runner sets `BRAINSTORM_BASE_URL` and its kin dead.

`test/event-tagging-firmware-seed.test.js` passes that screen but calls `http://localhost:7778/…` and `http://localhost:8877/…` directly, with no fallback to `BRAINSTORM_BASE_URL` (`:127`, `:137`, `:140`, `:151`). On this Mac, colima's ssh port forward listens on `*:7778` (and on `:7687`, `:6379`, `:7777`, `:7474` and `:80`) for the container Docker publishes there, Grawk's private agent-memory instance.

So in A10.1's Implementation run, that suite's live test "published tagging-with-specific-tag header carries literal recommended/allowed" ran against Grawk's instance, and it passed. That was two public read-only GETs, `/api/assistant/pubkey` and one `/api/strfry/scan`. Nothing was written. The two `:8877` tests skipped, since nothing listens there.

Fix shape, either or both:
- widen the screen with `localhost:[0-9]+|127\.0\.0\.1:[0-9]+`, so any suite with a literal local URL is read before it runs;
- make `event-tagging-firmware-seed` take its base URL from `BRAINSTORM_BASE_URL` (and its `:8877` probe from a variable), as the other live suites do.

Same class as OPEN.md row `2026-11-05-suite-probe-reaches-private-container`.

**Pointer:** `engineering-team/reviews/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md` § Harness friction 1
