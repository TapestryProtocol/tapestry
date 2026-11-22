# A scheduled task can start while a firmware install runs, because deploy-safety's buffer looks ahead only from when a check is made

**Id:** 2026-11-22-scheduled-task-can-start-mid-install
**Type:** bug
**Opened:** 2026-11-22. It is carried out of ledger row `2026-11-21-deploy-safety-misses-firmware-installs` when that row closed, for book `audits/deploy-safety-sees-installs/`. The observation is from the `header-tags-once` session's tags port, TapestryProtocol/tapestry#205.
**Status:** OPEN
**Done:** —

**What was seen.**
- **The install.** Tags' reinstall ran about 40 minutes on 2026-11-22, from 03:29:41 UTC to about 04:09, on a branch without staging's faster Pass 3.
- **A scheduled task started during it:** `refreshApplicabilityLists`.
- **Why.** Deploy-safety's ten-minute buffer covers only a fire due within ten minutes of the moment the answer is read. Read before an install starts, it says nothing about a fire later in a long install.

**What story deploy-safety-gate #4 does and doesn't change.**
- **It does:** while an install runs, the answer is unsafe with `FIRMWARE_INSTALL_RUNNING`, so a merge waits for the whole install.
- **It doesn't:** nothing keeps a scheduled task from starting during an install, or an install from starting during a task. The install procedure (`docs/SAFE_TO_MERGE.md`, "Before a firmware install") checks for a running deploy, not for a task due during the install.

**Whether it matters is not settled.**
- An install and a heavy task at once contend for Neo4j.
- Whether that harms either one hasn't been seen or ruled out.

**Fix shapes, none chosen:**
- **The procedure** checks that no scheduled fire falls within an install's expected length, not just the next ten minutes.
- **The scheduler** holds a fire while an install runs, as it would for a resource class.

**Pointer:**
- ledger row `2026-11-21-deploy-safety-misses-firmware-installs` ("A longer install");
- TapestryProtocol/tapestry#205;
- `docs/SAFE_TO_MERGE.md`.
