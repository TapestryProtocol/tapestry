# The "stack-free" registry guard suite runs a live suite against whatever answers on :7778

**Id:** 2026-10-31-stack-free-guard-suite-calls-7778
**Type:** meta
**Opened:** 2026-10-31 (book `config-secret-logging`, story `security-auth-exposure` #9 Test Design)
**Status:** OPEN
**Done:** —

`test/stack-free-npm-test.test.js` is the suite a Tester runs to prove a new suite is registered (its G5). Its G2
check probes `BRAINSTORM_BASE_URL` (default `http://localhost:7778`) and, when anything answers, runs the
`tag-detail` suite against it. On the Mac Studio since 2026-10-29, :7778 is Grawk's private agent-memory instance,
not a dev stack (container `tapestry`, compose project `agent-memory`). On 2026-10-31 a Tester run of the guard
suite therefore sent `tag-detail`'s requests to that instance. They were all GETs (checked afterwards), so nothing was
written, but a suite whose name says "stack-free" reached a live, private instance with no prompt.

Fix shapes: G2 skips unless an explicit opt-in variable is set (for example `STACK_FREE_LIVE_SAMPLE=1`); or G2
checks the container's compose project, as the agent-memory note in operator memory does by hand
(`docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' tapestry`), and skips on anything but the
dev stack; or the Tester workflow names the suite as not safe to run on that machine. Same family as OPEN.md row
`2026-09-27-test-fixture-taggings-on-prod-relays` (a test run reaching something it shouldn't).

**Pointer:** `test/stack-free-npm-test.test.js:143` (G2); `engineering-team/audits/config-secret-logging/audit.md` §7.
