# A local Playwright run with a failing test never exits: the HTML reporter serves its report and waits

**Id:** 2026-11-08-local-playwright-run-hangs-on-failure
**Type:** meta
**Opened:** 2026-11-08 (tagging-edges #7, fix round 2)
**Status:** OPEN
**Done:** —

`playwright.config.js` lists the `html` reporter with no `open` option, so off CI it opens on failure: after a run with
a failed test it prints "Serving HTML report at http://localhost:<port>. Press Ctrl+C to quit." and blocks. An agent
running a red browser spec, as Test Design and fix rounds do on purpose, gets no exit. Its background task never
completes, and a wait on the process waits forever. A green run exits normally, so the hang shows only when a test is
red. It cost story 7's fix round 2 about 20 minutes across two runs, whose results were written in seconds.

Workaround: set `PLAYWRIGHT_HTML_OPEN=never` on every agent-run `npx playwright test` (story 7's test plan, § How to
run, now does). Fix shape: `['html', { open: 'never' }]` in the config, or the setting in the run commands agents copy:
`.claude/agents/tester.md:22`, `.claude/agents/reviewer.md:22`, `engineering-team/roles/tester.md:16-17` and
`engineering-team/templates/test-plan.md:38`. *(Corrected 2026-11-08, at story 7's review round 3: this named "the cycle
skills", which run no Playwright.)* Either is a config or harness change for the owner to place.

**Pointer:** `engineering-team/stories/tagging-edges/7-confirm-held-removals.test-plan.md` § How to run
