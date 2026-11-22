# brainstormConfig ignores BRAINSTORM_CONF_PATH, so a scoped gate's dead conf doesn't switch the task queue off

**Id:** 2026-11-22-brainstorm-config-ignores-conf-path
**Type:** meta
**Opened:** 2026-11-22 (story deploy-safety-gate #4, review round 1, harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** Two modules read the instance's conf, and they find it in different places:
- **`src/utils/config.js`** (`getConfigFromFile`, used by the Neo4j driver) honors `BRAINSTORM_CONF_PATH`.
- **`src/utils/brainstormConfig.js`** reads the fixed path `/etc/brainstorm.conf` (`this.configPath`, :18). Its `get()` (:109-110) then falls back to `process.env`.

The deploy-safety answer reads `TASK_QUEUE_ENABLED` through the second. Other readers of the same flag use the first: `src/api/assistant/scores.js:138` and `src/api/assistant/selfMap.js:141` call `getConfigFromFile('TASK_QUEUE_ENABLED', 'false')`. So a dead conf reaches them, but not the deploy-safety answer.

**Why it matters for a scoped gate.** This Mac's scoped-gate recipe points `BRAINSTORM_CONF_PATH` at a dead conf, so that the Neo4j driver can't reach the agent-memory instance. That conf doesn't reach `brainstormConfig`.
- **The queue flag** comes from `/etc/brainstorm.conf`, if the host has one, and otherwise from `process.env`.
- **On this Mac and on CI** there is no `/etc/brainstorm.conf`, and `TASK_QUEUE_ENABLED` is unset, so the queue reads as off. Story 4's in-process handler tests rely on that.
- **Where the flag is on, the same suites fail:**
  - on a host whose `/etc/brainstorm.conf` enables the queue;
  - in a shell that exports `TASK_QUEUE_ENABLED=true`.

  A test process never starts the task queue, so `isQueueAvailable()` is false, with no Redis call made. Every answer is then unsafe with `QUEUE_STATE_UNAVAILABLE`, and `test/deploy-safety-sees-installs.test.js` H1 fails first, at the check that its answer is safe again once the install leaves.
- **ADR deploy-safety-gate/0004's first testing note** assumed the dead conf did the job. Amendment 1, item 5, corrects it.

**Fix shapes, none chosen:**
- **The recipe also exports `TASK_QUEUE_ENABLED=false`.** That only helps where no `/etc/brainstorm.conf` sets the flag, since the file wins over `process.env`.
- **`brainstormConfig` honors `BRAINSTORM_CONF_PATH`,** as `src/utils/config.js` does. That is a code change, with the readers of `/etc/brainstorm.conf` to check.
- **Suites that need the queue off say so up front.** A test that fails saying the queue is on beats one that fails on a verdict it didn't expect.

**Pointer:** `engineering-team/reviews/deploy-safety-gate/4-deploy-safety-sees-installs.md` (Harness friction 2); `src/utils/brainstormConfig.js:18`, `:109-110`; ADR `deploy-safety-gate/0004` (Amendment 1, item 5).
