# A live check's calls by hand leave their output only in the session's tool output, so the record's claims built on them can't be re-derived

**Id:** 2026-11-16-live-check-hand-calls-unsaved
**Type:** meta
**Opened:** 2026-11-16 (story graph-operations-first-slice #9, graph resolve, A10.9; its review, Harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** Story 9's live check ran three scripts, which wrote result files. It also made several calls by hand, whose output was never saved anywhere. Five of the story's Evidence claims rest only on those calls:
- the stranger's 403 from resolve, by its session cookie through nginx;
- 450 events after the firmware install;
- create-concept's `already-exists`;
- the scratch stack's missing constraints and its `tapestry_node_uuid` index;
- the agent-memory instance's counts.

The review's independent checker couldn't confirm any of the five. The Reviewer confirmed each only by searching the session's own tool results, which OPEN.md row 343 leaves undecided.

The record also didn't say that two of the first pass's 54 scripted checks had failed, on the script's own expectations, and were rechecked.

Even the scripts' result files live in a session scratchpad, outside the tree, which a reboot can clear. So the story's Evidence is the only durable record.

**Fix shape.** In the live-check steps that ADRs and test plans give, or in the Implementer's role, say:
- **Save every call made by hand** beside the scripts' results.
- **The record quotes what each claim rests on:** a status, a body, a count.
- **The record says when a scripted check failed,** why, and how it was rechecked.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/9-resolve.md` (Blocking 1, Harness friction 2); OPEN.md row 343.
