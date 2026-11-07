# `scripts/scratch-stack.sh` run from a path Docker Desktop doesn't share boots an empty `src/` and fails after 7.5 minutes with a misleading message

**Id:** 2026-11-07-scratch-stack-unshared-path
**Type:** meta
**Opened:** 2026-11-07 (openapi-coverage book close, retro; seen at its Test Design)
**Status:** OPEN
**Done:** —

The script mounts `$ROOT/src` read-only over the image's. When `$ROOT` is a tree in a Claude session scratchpad
(`/private/tmp/claude-501/…`), Docker Desktop on the Mac Studio doesn't share that path, so the mount is an empty
directory: `docker run --rm -v "<scratchpad>/src":/x:ro --entrypoint sh tapestry-tapestry -c 'ls /x/api'` answers "No
such file". The control panel can't start, the script polls `app_answers` 90 times, five seconds apart, and gives up
with "the scratch app did not come up in time", which points at the app rather than the mount. The test-design oracle
recipe (memory `test-design-oracle`, and the Direction-mode Tester) builds its oracle in a scratchpad, so it walks into
this; openapi-coverage #1 lost one boot to it and moved the oracle to the worktree's git-ignored `tmp/`.

Fix shape: before `docker run`, have the script check the mount from inside a throwaway container (the `ls` above) and
fail at once with "Docker can't see `$ROOT/src` — run from a checkout under /Users"; and say in the oracle recipe to
build the oracle under the checkout's `tmp/`, not in a scratchpad.

**Pointer:** `engineering-team/audits/openapi-coverage/audit.md` § 7, row 1; `engineering-team/stories/done/openapi-coverage/1-coverage-test-and-normalize-docs.test-plan.md` § How to run, step 1
