# The launcher's destroy test reads any "-v" in a command as a volume flag, so it fails whenever its temp folder's random name starts with "v"

**Id:** 2026-11-16-launcher-volume-check-matches-temp-path
**Type:** bug
**Opened:** 2026-11-16 (PR #83's CI, Actions run 43813017539 at 3f3d76aa)
**Status:** OPEN
**Done:** —

**What was seen.** PR #83's stack-free run at 3f3d76aa ended "Overall: FAIL — 7447 passed, 1 failed, 607 skipped". The one failure was `brains-launcher-service`'s "destroy detaches Caddy first, then removes containers and keeps volumes" (`deploy/launcher/test/compose.test.js`), with the error "destroy must not remove volumes". The same suite passed 139 of 139 in both earlier runs on 4df10d9b, and the commits between them add only a review file and two ledger rows.

**Cause, reproduced.** The test fails if any recorded command contains the text `-v`: `commands.some((c) => c.includes('-v'))`. Each command is the joined argument list, and `docker compose` gets the brain's folder twice, as `--project-directory` and in its `-f` path. That folder is under `tempDir()` (`deploy/launcher/test/helpers.js`), which is `mkdtemp` with the prefix `launcher-test-`, so a random name that starts with `v` puts `-v` into the path. Running the backend's real `destroy`, with the test's own fake `run`, in a folder named `launcher-test-vQ3x9a` gives two commands, no `-v` argument, and one command the check flags. In `launcher-test-Q3x9av` it flags none. `mkdtemp` draws from 62 letters and digits, so about one run in 62 fails.

**Fix shape.** Check the arguments, not the joined line: keep each command's arguments as an array and look for an argument that is exactly `-v` or `--volumes`. The test's other checks match on text such as `' down -v'`, which no path produces. Under OPERATIONS.md §15, a flake's answer is a cited quarantine entry, not a rerun, and OPEN.md row `2026-11-16-link-check-fails-during-prod-deploy` says why that isn't built.

**Pointer:** PR #83's CI (Actions run 43813017539); `deploy/launcher/test/compose.test.js`, "destroy detaches Caddy first…"; `deploy/launcher/test/helpers.js`, `tempDir`.
