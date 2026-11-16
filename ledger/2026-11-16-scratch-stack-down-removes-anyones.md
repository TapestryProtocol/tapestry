# `scripts/scratch-stack.sh down` removes the scratch stack by its name, whichever session booted it

**Id:** 2026-11-16-scratch-stack-down-removes-anyones
**Type:** meta
**Opened:** 2026-11-16 (story graph-operations-foundation #10's review, harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** Every session on this Mac boots its scratch stack under the same names: `tapestry-scratch`, `tapestry-scratch-redis` and `tapestry-scratch-net`. And `down` removes those names, whoever booted them (`scripts/scratch-stack.sh:34–38`).

On 2026-11-16, story 10's reviewer ran `down` on its own stack. Seconds later, the tapestry-keys session (worktree `awesome-ramanujan-76c6f8`) booted its own under the same name. The reviewer's next `up` was refused, as it should be: the script won't boot over an existing stack.

But a `down` run at that moment would have removed the other session's stack. Story briefs and test plans tell each session to "always finish with `down`".

**Why it matters.** The script exists so live checks never touch the owner's `tapestry` stack. But two sessions working in parallel on this Mac are now the usual case, and each removes the other's stack by the same name.

**Fix shape.** Either of:
- `down` checks that the running container mounts this checkout's `src/` (`docker inspect tapestry-scratch`, the bind mount's source) and refuses otherwise;
- or the names carry the worktree, e.g. `tapestry-scratch-<worktree>`, with `up` printing the container's name, as it does today.

Until then, a session runs `docker inspect --format '{{range .Mounts}}{{.Source}} {{end}}' tapestry-scratch` before `down`, and leaves a stack that isn't its own alone.

**Pointer:** `scripts/scratch-stack.sh`; `test/helpers/scratchLoopback.js` (which only checks the name starts with `tapestry-scratch`).
