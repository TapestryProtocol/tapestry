# scripts/scratch-stack.sh boots a stale default image and mounts only src/, so lib/ and test/ changes need a manual copy

**Id:** 2026-10-31-scratch-stack-image-and-lib-mount
**Type:** meta
**Opened:** 2026-10-31 (book `config-secret-logging`, stories `security-auth-exposure` #9 and #10)
**Status:** OPEN
**Done:** —

Two gaps found while using the scratch instance to rerun suites that need `node_modules`:

- **The default image is stale.** `SCRATCH_IMAGE` defaults to `tapestry-tapestry`, which on the Mac Studio was built
  2026-08-28 and is no longer rebuilt (the shared dev stack's containers are gone; the agent-memory instance builds
  `agent-memory-tapestry`). Booting it would run today's `src/` over August's `bin/` and `node_modules`. The session
  used `SCRATCH_IMAGE=agent-memory-tapestry` after checking that `package.json`, `bin/` and `docker/` match between
  that image's commit and `origin/staging`. Nothing in the script or its docs warns that the default can drift.
- **Only `src/` is mounted.** Story 10 changed `lib/config.js`, and both stories' suites live in `test/`; neither
  directory reaches the instance, so the session ran `docker cp test/. lib/.` into the container after boot. The app
  had already started on the image's `lib/`, which was harmless here but would hide a startup-time `lib/` change.

Fix shapes: mount `lib/` (read-only) beside `src/`, and copy or mount `test/`; check the image's creation date
against the checkout's last change to `package.json`, `bin/` or `docker/`, and warn or refuse when it's older.

**Pointer:** `scripts/scratch-stack.sh:24-26,80`; `engineering-team/audits/config-secret-logging/audit.md` §7.
