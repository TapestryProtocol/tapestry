# The scratch stack has one fixed name, so two sessions' live checks collide, and one's cleanup removes the other's instance

**Id:** 2026-11-08-scratch-stack-one-shared-name
**Type:** meta
**Opened:** 2026-11-08 (graph-operations-foundation #6, Loom A10.6: the live check's rerun at review round 1; the cause reported by the A10.2 session)
**Status:** OPEN
**Done:** —

`scripts/scratch-stack.sh` always uses the same names: the containers `tapestry-scratch` and `tapestry-scratch-redis`, and the network `tapestry-scratch-net`. Its `up` refuses when the name is taken ("already exists — use it, or run down first"). Its `down` removes whatever has those names with `docker rm -f`, whoever started it.

What happened, on the Mac Studio, 2026-11-08:
- Two sessions ran live checks within minutes of each other: A10.6, the external CLI, and A10.2, backup and restore.
- A10.6's instance was booting and installing its firmware. A10.2's script ran `up`, which failed on "already exists" at 23:02:43Z, and its failure path then ran `scripts/scratch-stack.sh down`.
- That removed A10.6's instance part-way through. Its bring-up died with exit 137, the SIGKILL of `docker rm -f`, and the A10.6 session first took it for a crash (story 6's Evidence, since corrected).
- A10.6's own wrapper had the same flaw: it ran `down` after its `up` failed, though it didn't strike this time.
- Both sessions fixed their own scratchpad wrappers. Each now records whether its own `up` started the instance, removes only that one, and touches nothing when the name is already taken.
- `scripts/scratch-stack.sh` is unchanged on both branches.

Candidates:
- A name per instance (`SCRATCH_NAME`, or the session or process id in the name), which `up` prints and `down <name>` takes.
- Or a lock the starting process holds while its instance is up, so `down` refuses an instance it didn't start unless forced.
- Either way, `up` and `down` should say whose instance the name belongs to.

**Pointer:** story `engineering-team/stories/graph-operations-foundation/6-external-cli-and-agent-skill.md` (Evidence: "The live check again"); `scripts/scratch-stack.sh`.
