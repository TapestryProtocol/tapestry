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

**Seen again, 2026-11-15 (graph-operations-first-slice #28, Loom A10.28).**
- **Two sessions needed it.** A10.16's and A10.28's live checks needed scratch stacks on the same Mac in the same hour.
- **What blocked them.** The fixed name kept them from running side by side. Memory would have stopped them anyway: with one scratch instance up beside the agent-memory instance and the other stacks, Docker's containers used 20.4 of its 23.4 GiB, so a second instance (about 2.6 GiB) risked the agent-memory container.
- **What worked.** The sessions took turns over cross-session messages. A10.28 ran a renamed copy of the script (`tapestry-scratch-a1028`, its own network and Redis) only once A10.16's instance was down.
- **The fix shape gains a part:** a name per instance doesn't by itself make two instances safe, so `up` should check the Docker VM's free memory first and refuse when a second instance wouldn't fit.

**2026-11-16 (graph-operations-foundation #9, review round 1, harness friction 1): the slot has no lease either.**
- **Who holds the slot is settled by message.** Four sessions used the one slot that evening: A10.28, A10.11, story 9 and story 9's Reviewer. Story 9 waited about 20 minutes twice, and its Reviewer found the slot busy the first two times it looked. Only because it came free near the end could the review re-run the live checks, and those re-runs found its Blocking 1.
- **The guard can't see a stack under another name.** A10.28's renamed copy of the script (above) started a container named `tapestry-scratch-a1028`, a name `scripts/scratch-stack.sh` doesn't make. The script's guard checks only `tapestry-scratch` (`scripts/scratch-stack.sh:61`), so another session's `up` would have started a second stack beside it. Only a `docker ps | grep tapestry-scratch` before booting stopped that.
- **Fix shape, beside the unique names above:** a lease file the script writes on `up` and removes on `down`, with who holds the slot, since when, and until when. Its `up` refuses while another's lease is live, and says whose it is, so a session or a Reviewer can queue for the slot instead of polling.
