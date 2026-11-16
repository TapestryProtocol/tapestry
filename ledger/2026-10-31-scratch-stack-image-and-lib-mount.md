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

**Seen again 2026-11-01** (book `config-parse-leak`, story `security-auth-exposure` #11). Running suites under the
image's bash without the scratch stack hit three more snags: `docker cp` merges into the image's own tree, so files
the branch deletes (here two dead copies) are still there and fail the suite; the session scratchpad under
`/private/tmp` isn't shared with Docker Desktop, so a bind mount of it is empty; and macOS `com.apple.provenance`
xattrs make `docker cp` of a tar stream fail unless it is made with `COPYFILE_DISABLE=1 tar --no-xattrs`. What
worked: `docker create` a throwaway container from the image, stream `git ls-files … | tar --no-xattrs -cf - -T -`
into a fresh `/tmp`, link the image's `node_modules` there, and run the suites from `/tmp`. A `scripts/` helper doing
that would replace the hand recipe.

**Seen again 2026-11-02 (book `neo4j-query-public-reads`):** a lighter recipe worked for stack-free suites: a
`node:22-bookworm` container with the checkout mounted read-only at `/app` and `node_modules` in a named volume filled
once by `npm ci --omit=dev --ignore-scripts` (the one run that needs the checkout writable, since Docker must create
the `node_modules` mount point). Suites with no `require.main` block have to be called through `run()`.

**2026-11-15 (graph-operations-foundation #8):** seen again. `tapestry-tapestry` was built 2026-08-28. Story 8 booted its scratch stacks with `SCRATCH_IMAGE=agent-memory-tapestry:latest`, built that day from `39126bfc` (staging's code). Its L5b baseline is tied to that image's firmware digest, and skips, saying so, on any other.

**Pointer:** `scripts/scratch-stack.sh:24-26,80`; `engineering-team/audits/config-secret-logging/audit.md` §7.

**Seen again 2026-11-16** (story graph-operations-first-slice #41, and its review). `firmware/` is a third folder the script doesn't mount. A firmware change's live check needs the branch's firmware in the instance before its first install. Both the Implementer and the Reviewer had to `docker cp` it into `firmware/versions/v1.0.0/` and run `supervisorctl restart brainstorm`, because the control panel caches the manifest at start. A bind mount of a copy in the session scratchpad came up empty, as the 2026-11-01 note found, and the control panel exited on the missing manifest.
