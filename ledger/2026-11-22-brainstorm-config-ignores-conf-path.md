# brainstormConfig ignores BRAINSTORM_CONF_PATH, so a scoped gate's dead conf doesn't switch the task queue off

**Id:** 2026-11-22-brainstorm-config-ignores-conf-path
**Type:** meta
**Opened:** 2026-11-22 (story deploy-safety-gate #4, review round 1, harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** Two modules read the instance's conf, and they find it in different places:
- **`src/utils/config.js`** (`getConfigFromFile`, used by the Neo4j driver) honors `BRAINSTORM_CONF_PATH`.
- **`src/utils/brainstormConfig.js`** reads the fixed path `/etc/brainstorm.conf` (`this.configPath`, :18). Its `get()` (:109-110) then falls back to `process.env`.

The second is the one that reads `TASK_QUEUE_ENABLED`, for the deploy-safety answer and others.

**Why it matters for a scoped gate.** This Mac's scoped-gate recipe points `BRAINSTORM_CONF_PATH` at a dead conf, so that the Neo4j driver can't reach the agent-memory instance. That conf doesn't reach `brainstormConfig`.
- **The queue flag** comes from `/etc/brainstorm.conf`, if the host has one, and otherwise from `process.env`.
- **On this Mac and on CI** there is no `/etc/brainstorm.conf`, and `TASK_QUEUE_ENABLED` is unset, so the queue reads as off. Story 4's in-process handler tests rely on that.
- **The same suites would reach for the task queue instead:**
  - on a host whose `/etc/brainstorm.conf` enables the queue;
  - in a shell that exports `TASK_QUEUE_ENABLED=true`.

  They would fail there, `test/deploy-safety-sees-installs.test.js` H8 first, since it pins `queue: { enabled: false }`.
- **ADR deploy-safety-gate/0004's first testing note** assumed the dead conf did the job. Amendment 1, item 5, corrects it.

**Fix shapes, none chosen:**
- **The recipe also exports `TASK_QUEUE_ENABLED=false`.** That only helps where no `/etc/brainstorm.conf` sets the flag, since the file wins over `process.env`.
- **`brainstormConfig` honors `BRAINSTORM_CONF_PATH`,** as `src/utils/config.js` does. That is a code change, with the readers of `/etc/brainstorm.conf` to check.
- **Suites that need the queue off say so up front.** A test that fails with a plain message beats one that fails on a Redis call.

**Pointer:** `engineering-team/reviews/deploy-safety-gate/4-deploy-safety-sees-installs.md` (Harness friction 2); `src/utils/brainstormConfig.js:18`, `:109-110`; ADR `deploy-safety-gate/0004` (Amendment 1, item 5).
