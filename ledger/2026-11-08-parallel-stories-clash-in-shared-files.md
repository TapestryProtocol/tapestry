# Two stories of one epic were planned at once in different sessions, with clashing assumptions and no step to reconcile them

**Id:** 2026-11-08-parallel-stories-clash-in-shared-files
**Type:** meta
**Opened:** 2026-11-08 (graph-operations-foundation #6, Loom A10.6: the review's Harness friction 3)
**Status:** OPEN
**Done:** —

graph-operations-foundation #2 (Loom A10.2, backup and restore) and #6 (A10.6, the external CLI) were planned and built at the same time, in different sessions, on different branches.

- **They assume different shapes.** #2 adds operations that download and upload a backup file, and changes the shared operations files to carry files (`declaration.js`, `http.js`, `index.js`, `openapi.js`, `cli.js`). #6's ADR 0006 assumes every answer and every body is JSON, so its CLI can't run #2's file operations once both land.
- **They edit the same files.** Both change `src/operations/http.js` and `src/operations/openapi.js`.
- **Nothing reconciles them.** The epic's note only solved the clash of story numbers (A10.n is story n). No step made either ADR read the other branch.

Candidate: when stories of one epic are in flight together, each ADR names the other's changes to the shared files and the operation shapes it assumes. Its gate then checks the other branch's tip. For #2 and #6: whichever lands second makes the CLI handle file operations, unless the owner decides otherwise (story 6, Out of scope).

**Pointer:** review `engineering-team/reviews/graph-operations-foundation/6-external-cli-and-agent-skill.md` (non-blocking 1, Harness friction 3); the A10.2 branch `A10.2-lifecycle-backup-restore` (`20d3fa902` when reviewed).
