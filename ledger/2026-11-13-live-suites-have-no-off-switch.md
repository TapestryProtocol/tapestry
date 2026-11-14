# A full `npm test` writes to whatever stack answers as `tapestry`, and no single setting turns the live suites off

**Id:** 2026-11-13-live-suites-have-no-off-switch
**Type:** meta
**Opened:** 2026-11-13 (workflow-hardening #1, Test Design: a full-gate baseline run)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The run.** A session ran the full gate for a baseline, with `BRAINSTORM_BASE_URL` pointed at a dead port so the
  live suites would skip. On that machine the container named `tapestry` was a long-lived instance, not a scratch
  stack.
- **What it wrote.** 103 events to that instance's relay, 91 of them signed by its Assistant, and 84 graph nodes
  with 525 tag nodes. Nine of the nodes were concept headers the instance did not have: six that the newer code
  creates on first use, two created by fixture flows, and one fixture concept.
- **Why the setting did not hold.** About forty suites don't read `BRAINSTORM_BASE_URL`. They reach the stack through
  `docker exec` on `$TAPESTRY_CONTAINER` (default `tapestry`) and through `localhost:$TAPESTRY_PORT` (default 7778).
  Three variables select the stack, and each suite reads its own subset, so a session that sets one believes it is
  isolated.
- **Nothing checks the target.** The live suites take whatever answers. Their own headers call the host's stack
  shared.
- **Clean teardowns still leave concepts.** By design a run tears down fixture elements and keeps the concepts it
  created at run time (`test/the-brain-survives.test.js`, header). Against a scratch stack that is harmless.
- **The docs point the wrong way.** CLAUDE.md's section on the Assistant's pubkey names a local-dev value "on this
  machine", which is true of one machine at one time. The Tester and Reviewer roles say to run `npm test` and don't
  say what it does to a stack that answers.
- **How it was put right.** The owner asked for the additions to be removed the same day. They were exported first,
  then removed by event id (`strfry delete`) and by uuid (the suites' own teardown statement, through the container's
  `/api/neo4j/query`). The relay and graph counts afterwards matched the counts before the run, less exactly those
  additions.

**Fix shape.**
- **One switch.** A single variable, read by every live suite through `test/helpers/stackHttp.js`, that turns live
  tests off whatever else is set. The CI job is the stack-free case today only because nothing answers there.
- **Name the target, or don't write.** Live suites that write refuse to run unless the stack is named on purpose,
  for example by a variable naming the container, or by a marker the scratch stack carries. The default of
  "whatever is called `tapestry`" goes.
- **Say it where a session reads it.** The Tester and Reviewer roles and the test-gate section of
  `engineering-team/README.md` say that a full run writes to a reachable stack, and how to run stack-free.
- **Drop the machine-specific pubkey from CLAUDE.md.** It needs only "never hardcode"; which instance a machine runs
  is found by asking it.

**Pointer:** `test/helpers/stackHttp.js`; `engineering-team/workflows/3-test-design.md`;
`engineering-team/stories/workflow-hardening/1-harden-the-github-workflows.test-plan.md` ("Where the full gate's
result comes from"); related: OPEN.md rows 94 and 263.
