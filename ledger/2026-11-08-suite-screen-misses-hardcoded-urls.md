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

**2026-11-21 — story graph-operations-first-slice #47's three gates did the same.** Each listed this suite, since it reads firmware's files: the Implementer's gate (`20261120T235304Z-73207-0e2c`), review round 1's (`20261121T002100Z-6796-ac63`), and the gate after round 1's fixes (`20261121T004946Z-57222-e9ab`). In each, its `:7778` check made the same two read-only GETs to the agent-memory instance and passed, and the two `:8877` checks skipped. Nothing was written. The story's Evidence said "every endpoint dead" and "nothing reached a container" until review round 2 found it (non-blocking 3). That round ran the suite in a sandbox that refuses colima's ports. Until this row's fix lands, leave the suite out of a scoped gate on this Mac, or run it that way.

**Pointer:** `engineering-team/reviews/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md` § Harness friction 1
