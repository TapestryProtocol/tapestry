# A Playwright run without tests/global-setup.js skips every spec that needs the server and reports no failure, which reads as a run

**Id:** 2026-11-05-playwright-skips-without-globalsetup
**Type:** meta
**Opened:** 2026-11-05 (setup-create-account #2, review round 1's Harness friction 1; dispositioned at the book's close)
**Status:** OPEN
**Done:** —

**The mechanism.**
- 56 specs under `tests/brainstorm/` skip every test unless `BRAINSTORM_SERVER_ACCESSIBLE` is `true`, for example
  `tests/brainstorm/setup-open-sign-up.spec.js:286`.
- Only `tests/global-setup.js` sets it (`:44` and `:50`), after probing the server.
- A Playwright config that leaves out globalSetup therefore runs none of them. Reviews and oracles on the Mac Studio do
  exactly that: they use a scratch config, chromium only, against a mocked preview build.
- The output is "N skipped", with no failure and exit 0.

**What happened.** Story 2's review brief gave the scratch config's command without the variable.
- The reviewer got "13 skipped", saw the problem, and re-ran with `BRAINSTORM_SERVER_ACCESSIBLE=true` (13 passed).
- The story's test plan had the right command. The brief, written by the coordinating session, didn't.
- A less careful reader, or a Direction-mode judge reading counts, would have taken "0 failed" as a pass.

**Fix shape** (any one would do):
- **(a)** The review checklist's Playwright line says that an all-skipped spec is not a run, and asks for the
  passed count.
- **(b)** Briefs quote the test plan's own command, not a reconstruction.
- **(c)** A spec could fail loudly instead of skipping when it is run by name. That is a larger change, and it
  touches 56 files.

A sibling of the Node-side trap where `node test/<suite>.test.js` exits 0 without running anything.

**Pointer:** `engineering-team/reviews/done/setup-create-account/2-open-sign-up.md` (round 1, Quality gates and Harness
friction 1); `engineering-team/templates/review-checklist.md`; `tests/global-setup.js`.
