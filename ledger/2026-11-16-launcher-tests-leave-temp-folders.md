# The launcher's tests never remove their temp folders, 104 a run, and under a long TMPDIR control.test.js's socket path is too long to listen on

**Id:** 2026-11-16-launcher-tests-leave-temp-folders
**Type:** cleanup
**Opened:** 2026-11-16 (review of #91, its non-blocking 3)
**Status:** OPEN
**Done:** —

**What was seen.** #91's review (`engineering-team/reviews/brains-launcher/launcher-volume-check-args.md`, non-blocking 3) found two things about the launcher tests' temp folders, both checked again before this row was filed.
- **Nothing removes them.** `tempDir()` (`deploy/launcher/test/helpers.js`) makes each folder with `mkdtemp`. One run of the launcher's tests (`node --test deploy/launcher/test/*.test.js`, 139 passing) leaves 104 new `launcher-test-*` folders in `$TMPDIR`. The repeated runs of #90's and #91's reviews on 2026-11-16 left 29,942 on the owner's Mac, where `$TMPDIR` reached 503 MB.
- **A long TMPDIR breaks control.test.js.** It listens on `control.sock` inside a `tempDir()` folder (`deploy/launcher/test/control.test.js:25–27`). With a `TMPDIR` of 196 characters, 8 of its 9 tests fail with `listen EINVAL`, because the socket's path passes macOS's limit of 104 bytes for a Unix socket. With the default `TMPDIR` it passes 9 of 9.

CI's runner has a short `/tmp`, so neither affects the gate today.

**Fix shape.** Remove each folder when its test ends (`t.after`, or one cleanup for each file). Give the control socket a short path of its own, or check the path's length and fail with a clear message.

**Pointer:** the review above; `deploy/launcher/test/helpers.js`, `tempDir`; `deploy/launcher/test/control.test.js:25–27`.
