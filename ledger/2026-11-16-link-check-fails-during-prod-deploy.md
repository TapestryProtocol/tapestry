# The briefing's link check fails any pull request whose CI reaches it while production deploys, reading the deploy's 502 as a broken link

**Id:** 2026-11-16-link-check-fails-during-prod-deploy
**Type:** meta
**Opened:** 2026-11-16 (PR #83's first CI run, Actions run 43808151504)
**Status:** OPEN
**Done:** —

**What was seen.** PR #83's stack-free run, at 4df10d9b, ended "Overall: FAIL — 7447 passed, 1 failed, 607 skipped". The one failure was `information-for-agents` L1: "https://tapestry.brainstorm.world must resolve with a 2xx; got 502", at 05:09:30Z on 2026-11-16. A production deploy, "Deploy to Tapestry" (Actions run 43808217938 on `main`, commit e58e016f), ran from 05:07:46Z to 05:09:48Z, so the check reached the site while its container restarted. The site answered 200 at 05:29Z. A rerun of the job, its attempt 2, passed L1 and failed another test (OPEN.md row `2026-11-16-k1-lock-check-races-worker`).

The L-class tests SKIP on a network failure and on a cloud egress gateway's own 403 (OPEN.md row `2026-10-04-llms-txt-egress-403-false-fail`), and any other non-2xx FAILs (`test/information-for-agents.test.js`, the L-class note in its header). A deploy's 502 is the site's own proxy answering while the app restarts: it passes in a minute or two, but a single request can't tell it from a broken deployment. Every merge into `main` deploys, so any pull request whose CI reaches L1 during those minutes fails, whatever it changes.

**Why it is a harness lesson.** OPERATIONS.md §15's no-retry policy rests on the stack-free suite's "zero recorded-flake history", since "all documented nondeterminism lives in the excluded live `*-publish` class". The L-class tests are live checks too: they fetch the public internet, and they don't skip when the stack is absent, so they sit inside the gate that policy covers. The policy's answer to a flake is "not a retry but a cited quarantine entry" in a file that doesn't exist yet, and nothing reads such a file today: no "quarantine" appears in `test/test.js`, `test/registry.js`, `test/helpers/` or `scripts/`. Creating it now would record a flake but change no run. The rerun above was requested before §15 was read. Under §15 it doesn't change the verdict, which for 4df10d9b is attempt 1's FAIL.

**Fix shape.** Options, for the owner to choose between:
- Move the L-class out of the stack-free gate, beside the live classes §15 already excludes, behind a switch a scheduled job or a person turns on.
- Retry a 502, 503 or 504 a few times, about a deploy's length apart, before failing, so that a link that stays 5xx still fails. Whether a retry inside a test fits §15's "no retry … anywhere in the job" is part of the choice.
- Read a 5xx as SKIP, naming its status, as the egress 403 is read. That loses the outage alarm.
- Build the quarantine §15 describes, so the gate reads the file and shows each waived suite on every run. It waives a whole suite: here, 57 tests for one.

**Pointer:** PR #83's CI (Actions run 43808151504, attempts 1 and 2); `test/information-for-agents.test.js`, the L-class tests and the fetch they use; OPERATIONS.md §15, "No-retry policy" and "First-flake waiver pattern".
