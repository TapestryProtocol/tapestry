# Story 6: The external CLI and the agent's skill — an admin agent calls every operation from outside the instance

**Status:** Approved
**Created:** 2026-11-08
**Type:** Feature
**Loom:** A10.6 — https://loom.brainstorm.world/t/A10.6

*Numbered 6 to match its Loom task. A10.2's story is being planned at the same time in another session and would also take #2, so this epic's foundation stories are numbered by their Loom task: A10.n is story n.*

## Background

Story 1 (Loom A10.1) declared each graph operation once in the instance. Each operation is reached at `/api/tapestry/<group>/<operation>`, by `tapestry <group> <operation>` from a shell inside the instance, and in `/docs`. It is also listed: `GET /api/tapestry/operations` gives the caller every operation it may call, with its group, name, route, inputs, result and refusals, "in a form a program can read" (story 1, AC7). Story 1 added that list for this story, because "A10.6 wants an external CLI that reads the declared operations from the instance and needs no change when an operation is added" (story 1, open question 2).

**Who calls the operations.** The owner (2026-11-07): "It assumes an owner who is human and a set of admins, with each admin being a nostr account controlled by one of several agents. (One key held by Claude, one key held by Grok Bot, one key held by local model A on machine A, etc)". The owner makes a key an admin on the instance's administrators page, which only the owner may use. The instance checks the admin list on every call, so removing a key stops it at once, even with a sign-in still open.

**The layers above the routes,** in the owner's list (design §2, 2026-11-07):

> * an agentic harness (one or more skill files) which explain how to use the external CLI
> * an external CLI which signs in to the API with the agent's nostr key, which is an admin on the instance, and calls the routes. It has no Cypher access.

**Which CLI (D14, 2026-11-08).** The owner: "Given that we are rebuilding the operations and the stack from scratch, it seems to me we should build the external CLI from scratch, not rely upon Avi's or Vinney's CLIs which define operations differently from the way the rest of the stack defines them." The decision, as the design doc records it:

- The CLI is new, lives in this repo, and defines no operations.
- It signs in with the agent's own key, reads the list from the instance it's talking to, and turns each operation into `tapestry <group> <operation>`, so it stays in step with each instance, whatever version that instance runs.
- It takes lessons, not operation definitions, from A9 (signing with an agent's own admin key; its findings on caps, logs and tool descriptions) and from Vinney's `brain` (its commands for an agent starting cold).
- An MCP server comes later and works the same way.

Memo 95 on Loom A10.6 records it. A9's code is in NosFabrica/brainstorm-connector, which this machine's GitHub login can't read; the Architect should ask Avi for the findings that matter.

**Where the team's two CLIs keep the key** (checked 2026-11-08, at the owner's request):

- **Vinney's `brain`** (vcavallo/brainstorm-harness, `master` at `53b8abc`):
  - *On its own machine's instance* it uses no key for the graph. It reads over HTTP and writes with `docker exec … curl` inside the container, which the instance trusts as a local caller, and the instance's own Assistant key signs the events.
  - *On a hosted instance,* `brain login <name>` signs the instance's challenge, as the owner by default or as an admin's key with `--as`. The signature comes from a NIP-46 remote signer by default ("your key stays in the signer; approve there"), from a key pasted once at a hidden prompt ("never stored"), or from `NOSTR_SECRET_KEY`, and `nak` does the signing. Afterwards `brain` keeps only the session cookie, in a file readable only by its user, beside the remote signer's address, which carries that connection's secret.
  - *Its own agent key* is a plain file, `agent.hex`, made with `nak key generate` and set readable only by its user. It's the agent's nostr identity for DMs, not for the graph or the sign-in.
- **Avi's A9 CLI and MCP server:** the agent signs the challenge itself, with its own key that the owner made an admin (Loom A9.2, and A9.3.b on avi.tapestry.ninja with "a new throwaway agent key"). Where the key is kept, a file, an environment variable or something else, isn't in any record this machine can read.

**Today.** An agent outside an instance can reach these routes only by doing the instance's sign-in by hand: ask for a challenge, sign it with its key, send it back, keep the session, and then build each request itself. Story 1's live check went through the container's own loopback as a local caller, so no admin agent has yet called an operation from outside an instance.

**Why now.** Every later operation task in Loom's A10 block (A10.7 onward) waits on this one, because each operation is meant to be used by an agent the day it lands (P-153: "find any specific operation that we want to use, see if it's built or not, assign ourselves to it, then build it and use it."). Loom's done-when for A10.6: "Done when an agent with only its own admin key and an instance's URL calls every declared operation through the CLI, and the skill tells it how."

## User-facing description

As an admin agent holding my own nostr key, I want one command that signs me in to a Tapestry instance and calls any operation the instance declares, by group and name, so that I can read and change the owner's graph through the operations that keep it valid: without raw Cypher, without the owner's key, and without a client someone has to change whenever an operation is added.

As an agent starting cold, I want a skill that tells me how to set the CLI up, check that my key is an admin on the instance, find which operations exist and what each one takes, call them, and read their answers and refusals.

As the owner, I want each agent to use its own key, made an admin on my instance, so that the instance knows which agent made each call, and I can take an agent's access away by removing its key.

## Acceptance criteria

- [ ] **AC1 — Signing in with the agent's own key.**
  - Given a secret key that is an admin on an instance, and that instance's URL, when the agent runs an operation through the CLI, then the CLI signs in with the instance's existing signed-challenge sign-in, using that key, and the call is made as that admin.
  - Given the key is already signed in to that instance, then later calls reuse that sign-in rather than signing in again.
  - Given the instance no longer accepts the sign-in (it expired or was revoked), then the CLI signs in again once, by itself, and retries the call once.
  - The key is used only to sign the sign-in challenge, and it is never sent: the instance receives the public key and the signed challenge, and nothing else from the key.
- [ ] **AC2 — The operations come from the instance.**
  - Given an instance, when the agent runs `tapestry` on its own, then it lists the operations that instance lets this key call, by group, each with its one-line summary.
  - `tapestry <group>` lists one group's operations, and `tapestry <group> <operation> --help` shows the operation's inputs, result, refusals, who may call it and its route, all from the instance's own list.
  - Given an operation is added on the instance, and nothing about the CLI changes, then the CLI lists it and runs it.
  - Given an operation the instance doesn't list for this key, then the CLI says it isn't among the operations this key may call on that instance (it may not exist there, or it may be the owner's only), lists the ones it may call, and exits 2.
- [ ] **AC3 — Calling an operation, and its answer.**
  - When the agent runs `tapestry <group> <operation> --name value …`, then the CLI calls that operation's route on the instance with those inputs and prints the instance's JSON answer on stdout as it came, success or refusal, with nothing else on stdout.
  - Inputs are given by their declared names, with the same flags as the command inside the instance: `--name=value` works too, a flag with no value is true, and a repeated flag makes a list. Each value reaches the instance as the type its declaration names, so the same flags work for a read and for a write.
  - The instance checks the inputs. An unknown, missing or ill-typed input comes back as the instance's own 400 refusal.
  - The exit codes are the internal command's: 0 for an answer, 1 for a refusal, 2 for usage, 3 for a failure. A failure is the instance's 500, an instance that can't be reached, or an answer that isn't the instance's JSON, and each failure gets a one-line reason on stderr.
- [ ] **AC4 — The key, the instance, and who the agent is there.**
  - How an agent keeps its key is the agent's own business (open question 1). The agent gives the CLI its key the way its own setup allows: a key the CLI reads when it signs in, or a signer of the agent's own that signs the challenge for it. The CLI never stores, prints or sends the key. As a guard against a slip, it refuses a key file that other users on the machine can read, as ssh does with a private key.
  - An agent with no key yet can make one with the CLI and print its public key (npub and hex), to hand to the owner.
  - Each agent's calls go out under its own key and its own sign-ins. Several agents can use the CLI on one machine, each with its own key. The CLI keeps each key's sign-ins apart, by default where only the agent's user can read them, or where the agent says, and never uses one agent's key or sign-in for another agent's call.
  - The agent names the instance for a call, or sets a default. It can be signed in to several instances at once, each with its own sign-in, stored where only its user can read it.
  - The agent can ask the CLI who it is on an instance: its npub, and whether the instance treats it as the owner, an admin, or neither.
  - Given a key that signs in but is neither the owner nor an admin, then every operation command says so plainly, naming the key and the instance and saying that the owner can make it an admin, and exits 1, rather than showing an empty list.
  - Given no key is set up, then the CLI says how to set one up, and exits 2.
- [ ] **AC5 — Only the operations, and nothing signed but the sign-in.** The CLI reaches the instance only through its sign-in and the routes under `/api/tapestry/`: no raw Cypher, and none of the instance's other routes. The only thing it has the agent's key sign is the instance's sign-in challenge, and it never publishes anything to a relay.
- [ ] **AC6 — The skill.**
  - A skill in the format Claude Code and OpenClaw load (a name, a one-line description of when to use it, then the instructions), which any other agent can read as plain instructions.
  - It tells an agent:
    - what the operations are for: the owner's own graph, changed through operations that check its rules, with nothing published to nostr;
    - how to install the CLI;
    - how to give the CLI its own key, whichever way it keeps it, or make one, and have the owner make it an admin;
    - how to choose the instance;
    - to start cold by asking who it is there and running `lifecycle status`;
    - how to find the operations and read an operation's help;
    - how to read answers, refusals and exit codes;
    - what never to do: ask for or use another's key, the owner's included, or share its own; reach for raw Cypher or the instance's older routes; repeat a refused write without reading why it was refused.
  - It lists no operation by hand. It sends the agent to the CLI's listing and help, so a new operation needs no change to the skill.
  - A test fails when the skill names a command, flag or exit code the CLI doesn't have, or when the CLI has a command of its own that the skill doesn't explain.
- [ ] **AC7 — Proved end to end (Loom's done-when).** Given a fresh instance where the owner has made an agent's new key an admin, when the agent, with only that key, the instance's URL and the skill, calls every operation the instance declares for admins through the CLI (today `lifecycle status`, and any that land before this story does), then each answers as the instance's own command answers it. An owner-only operation, if one exists by then, is refused with the instance's 403. This is checked live on a scratch stack, never on a shared or private instance.

Seven criteria, past the usual five, as in story 1. They aren't split: AC1–AC5 are the CLI's parts, AC6 is the skill and AC7 is Loom's done-when. A CLI without the skill is one no agent knows how to use, and Loom tracks them as one task.

## Concepts touched

None. The CLI reads no concept itself. The operations it calls touch what they touch, under their own stories.

## Out of scope

- **An MCP server.** D14 adds one later, made the same way. Where it runs is decided when it's built.
- **Operations that send or take a file.** The CLI speaks JSON only. The A10.2 branch (backup and restore) adds operations that download and upload a backup file, which an admin may call. Whichever of the two lands second makes the CLI handle them, unless the owner decides otherwise (review round 1, non-blocking 1).
- **The instance's side.** No new operation, and no change to how operations are declared, routed, listed or documented (story 1). If the Architect finds the list lacks a fact the CLI needs, that's a change to story 1's shared files, to raise at the architecture gate.
- **The instance's sign-in.** No new kind of sign-in for agents, such as tokens. The CLI uses the signed-challenge sign-in the instance has.
- **Making a key an admin from the CLI.** The owner does that on the instance.
- **How an agent protects its key.** That's each agent's own business, as it is between any two nostr users (open question 1). The CLI takes the key the way the agent's setup gives it, and never stores it.
- **Publishing the CLI** to a package registry, unless open question 2 brings it in.
- **A record, on the agent's machine, of the calls it made.** Who changed what is recorded on the instance, by the write path (A10.4).
- **Avi's and Vinney's tools.** They keep working and aren't brought up to code (D15).
- **Read visibility** (catalog §10, question 1). The operations stay behind sign-in.
- **Any UI.**
- **Merging to staging and shipping to production,** which wait for the owner's OK (the book's frame).

## Open questions

Both were resolved at the planning gate on 2026-11-08, where the owner approved the story: question 1 by the owner's own answer, and question 2 by taking the Product Owner's recommendation.

**Why the key comes into it at all** (asked by the owner at the planning gate, 2026-11-08). The instance's sign-in has no passwords or tokens: it sends a one-time challenge, and the caller proves it holds a key by sending the challenge back signed with that key. An admin is a key on the owner's list. So the CLI needs one signature from the agent's key each time it signs in to an instance, not the key itself on every call. The key is never sent: the instance receives only the public key and the signature. After that, the instance's sign-in (about 30 days) carries the calls. That sign-in is what the CLI keeps, and it is a weaker credential: one instance only, it expires, it can't sign anything on nostr, and it stops working the moment the owner removes the key from the admins. The key matters more, because it is the agent's nostr identity everywhere, and a nostr key can't be changed, only abandoned.

1. **How does the agent's key reach the CLI?** *Answered by the owner, 2026-11-08:* "Each agent has its own nsec and can sign events with it. We assume that agent 1 does not have access to agent 2's nsec. How each agent protects his nsec is up to that agent. Different agents have different setups and will use different methods to protect their nsecs. The method that we ensure agent 1 does not have access to agent 2's nsec is the same method that we use to ensure any given user, like Alice, does not have access to Bob's nsec."
   - So the CLI takes no position on how a key is kept. It takes each agent's key the way that agent's setup gives it: read from where the agent keeps it when the CLI signs in, or signed by a signer of the agent's own (AC4). Which ways it supports first is the Architect's to propose.
   - This settles the planning gate's discussion of key files and remote signers: neither is the CLI's to choose. The owner's case for it was four admin agents (Claude, Grok, an open-source model on a desktop and another on a laptop), each with its own key.
2. **Where does an agent get the CLI?** *Resolved: from this repo.*
   - *Recommendation:* from this repo. The CLI installs on its own from a checkout of the repo, without the instance's server and its dependencies, and the skill says how. It uses the agent's key, or its signer, and keeps its sign-ins, so it should come from the team's own source rather than from whichever instance the agent talks to.
   - *Alternatives:* each instance also hands the CLI out, so the agent needs nothing but the URL, but then it trusts every instance's copy with its key; or the CLI is published to a package registry for a one-line install, which needs an account and a publishing step.

## Deviations

Small judgment calls made in Implementation, inside the ADR:

- Two small additions to Decision 1's layout. `src/errors.js` holds the CLI's four error kinds:
  - `Usage`, exit 2;
  - `Setup`, a `Usage` for no key or no instance;
  - `Refused`, exit 1;
  - `Failed`, exit 3.

  And `config.json` is read and written in `src/identity.js`, beside the home it lives in, rather than in a module of its own.
- `tapestry help`, `--help` or a bare `tapestry` with nothing set up (no key or no instance) prints how to set up and exits 0. Any other problem (a key file others can read, a bad URL) still fails it, so help never hides a real fault.
- `tapestry key new` onto an existing file exits 2, naming the file, and leaves it as it was.
- A list entry whose route isn't under `/api/tapestry/`, or whose method isn't GET or POST, is never called: exit 3. This guards AC5 against a wrong list.
- The re-sign-in after a 401 happens at most once per run, not once per call, so no run signs in more than twice.
- An instance whose list doesn't name its `caller` yet (one older than this story) is answered with `role: "owner or admin"`, so the CLI still works against it.
- A signer's event may carry a `created_at` up to 600 s from the one asked for, the instance's own window, in case a signer stamps the time itself. Its kind, pubkey, content and tags must be the same, and its signature must verify.
- The lockfile was made offline from npm's cache (`npm install --package-lock-only --offline`). Its two direct dependencies are the root's exact versions; npm chose the indirect ones (`@noble/ciphers` 0.5.3, for one).

The review's round 1 fixes, inside the ADR as amended (Decision 5):

- **Retries (B2).** Only the instance's own sign-in 401 is retried after a new sign-in: the central check's, with no `code`, or `sign-in-required`. An operation's declared 401 is a refusal. It is never resent, the kept sign-in stays, and stderr doesn't blame the sign-in (`clients/cli/src/signin.js` `isSignInRefusal`).
- **The route guard** also refuses a listed route with a dot segment, plain or `%2e`, a backslash or an empty segment, or one that a URL would normalize to another path.
- **A signer runs in a process group of its own,** so its timeout ends the programs it started, not only its shell. That was checked by hand with a one-second copy: a signer command that started two `sleep`s left none behind.
- **The Node check** also tests `Headers#getSetCookie` and names the Node it found, so Node 18 is told why.
- **The skill** now says:
  - a failed write may have run, so read back what it would have changed before trying it again;
  - what the `local` role means, and to use the instance's public address so its changes are known to be the agent's.

## Evidence

### The suites (review round 1, 2026-11-08, on the committed tree)

The full `npm test` was not run on this machine, because its live suites can reach a private instance here; CI runs the gate on the pull request.

Instead, eleven suites ran one by one through their `run()` exports, on Node 24.18.0, with every service endpoint dead. They are the story's own suites and those the change touches: everything that reads the route table, the API document, `.dockerignore`, the test registry or the committed tree.

They ran at `c179e7e49` with nothing uncommitted but the `node_modules` link. That is the round-1 lesson: `brains-launcher-repo` W1c reads `git ls-tree HEAD`, so a run before the implementation commit couldn't see the new `clients/` (review B1). Implementation's own table said 31/0 for that suite, but it was taken before `clients/` was committed. At that commit the suite fails 30/1, as the review found.

The screen for `docker exec`, `TAPESTRY_PORT` and `:7778` found text only, nothing that calls them:
- an assertion message in `brains-launcher-repo`;
- the `localhost:7778` fallback in `stack-free-npm-test.test.js:43`, which the runner points at a dead port;
- two lines of fixture text for L5 in `harness-lint.test.js`.

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| `external-cli` (Test Design: 0 of 49; round 1 adds S7 and K11) | 51 | 0 | 0 |
| `operations`, with H16 and D6 (Test Design: 46 passed, 2 failed) | 48 | 0 | 0 |
| `openapi-coverage` | 13 | 0 | 0 |
| `openapi-document` | 10 | 0 | 0 |
| `admin-action-sweep` | 9 | 0 | 0 |
| `admin-action-sweep-access` | 13 | 0 | 0 |
| `default-deny-mutations` | 14 | 0 | 0 |
| `stack-free-npm-test` (G5: the registry is complete) | 6 | 0 | 1 |
| `brains-launcher-repo` (W1c lists `clients/`) | 31 | 0 | 0 |
| `harness-lint` | 85 | 0 | 0 |
| `harness-stats` | 12 | 0 | 0 |
| **Total** | **292** | **0** | **1** |

The reviewer's mutation probe now fails SK3 for both cases it found: an exit code 4, and `tapestry key rotate`. Its controls fail it too.

**The install.** The README's install was tried on a copy of `clients/cli` in a temporary folder. `npm ci --omit=dev --offline` added 15 packages (nostr-tools, ajv and their own), and the CLI loaded nostr-tools from its own `node_modules`, not the repo's.

### The live check again (AC7, review round 1, 2026-11-08)

The check was run again on the fix round's code (`c179e7e49`), from a standalone install made with `git archive HEAD clients/cli` and `npm ci --omit=dev --offline`, the same as the committed `clients/cli`. Its path, steps and checks are Implementation's, below.

- **The first try failed, from outside.** The scratch instance was removed while its firmware was installing: exit 137 is the SIGKILL of `docker rm -f`. The A10.2 session's own live check did it, and said so in a message to this session: it found this instance running under the shared name `tapestry-scratch`, failed on "already exists", and its failure path ran `scripts/scratch-stack.sh down`. Nothing was left behind, and the shared containers stayed up.
- **The retry passed every step:**
  - `whoami` answered `neither`, exit 1, until the owner made the key an admin, then `admin`, exit 0;
  - `tapestry` listed `lifecycle status`, and its answer through the CLI was the same as the internal command's, both exit 0;
  - a second key that nobody made an admin got `neither`, exit 1;
  - the home was `drwx------`, its files `-rw-------`.
- **What nginx's log shows,** for this one run alone: `POST /api/auth/verify-user` 200 and `POST /api/auth/login-user` 200, twice each (the agent and the second key); `GET /api/tapestry/operations` 403 twice, then 200 three times; `GET /api/tapestry/lifecycle/status` 200 once. Nothing else.
- **Removed afterwards,** with no scratch container left.

### The live check (AC7, Implementation, 2026-11-08)

**The instance.** A throwaway instance (`scripts/scratch-stack.sh`):
- image `tapestry-tapestry`, with this branch's `src/` mounted;
- firmware installed;
- no published ports;
- removed afterwards, with nothing left behind.

Docker had about 4.9 GB free, so nothing was paused.

**The path in.** The CLI ran on this Mac, from the standalone install, with a fresh `TAPESTRY_HOME` and HOME. It went through a TCP relay from the same local image, on a loopback port, to the instance's nginx. So every request reached the app with `X-Forwarded-For`, as an outside agent's does, and nothing was trusted as local.

1. **The key.** `tapestry key new` printed `{ file, npub, pubkey }`.
2. **Before the owner acted,** `tapestry whoami` answered `role: neither`, exit 1, with the plain message naming the npub, the instance and the administrators page.
3. **The owner made the key an admin** by saving the setting the administrators page saves (`updateOverrides({ adminPubkeys })`, inside the container).
4. **The calls.** `tapestry use <url>`, then:
   - `tapestry whoami`: `role: admin`, exit 0;
   - `tapestry` listed `lifecycle status`, the one operation the instance declares here;
   - `tapestry lifecycle status` exited 0, and its JSON, parsed, was the same as the internal command's, `tapestry lifecycle status` inside the container, which also exited 0: firmware 1.0.0 `all`, 39 of 39; cache 3,142 nodes, 428 cached.
5. **A second key** that nobody made an admin: `whoami` answered `neither`, exit 1.
6. **What reached the instance.** nginx's log shows the CLI reached only `POST /api/auth/verify-user`, `POST /api/auth/login-user`, `GET /api/tapestry/operations` and `GET /api/tapestry/lifecycle/status`.
7. **What the agent keeps.** Its home was `drwx------`, and its `config.json`, `key` and `sessions.json` were each `-rw-------`.

## Linked artifacts

- Loom: [A10.6](https://loom.brainstorm.world/t/A10.6), memo 95 (D14 and D15)
- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's "The rebuild" bullet: "An agent with only its own key, made an admin, and the instance's URL")
- Epic: [engineering-team/epics/graph-operations-foundation.md](../../epics/graph-operations-foundation.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (§2, D14, D15)
- Story 1 and its ADR: [1-operation-declaration-and-lifecycle-status.md](1-operation-declaration-and-lifecycle-status.md); [ADR graph-operations-foundation/0001](../../decisions/graph-operations-foundation/0001-declare-each-operation-once.md) (Decision 7, the command's flags and exit codes; Decision 8, the list)
- ADR: [ADR graph-operations-foundation/0006](../../decisions/graph-operations-foundation/0006-external-cli-made-from-the-operations-list.md)
- Test plan: [6-external-cli-and-agent-skill.test-plan.md](6-external-cli-and-agent-skill.test-plan.md)
- Review: [6-external-cli-and-agent-skill.md](../../reviews/graph-operations-foundation/6-external-cli-and-agent-skill.md)
