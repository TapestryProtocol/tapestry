# Test Plan: Story 6 — The external CLI and the agent's skill

**Story:** `engineering-team/stories/graph-operations-foundation/6-external-cli-and-agent-skill.md`
**ADR:** `engineering-team/decisions/graph-operations-foundation/0006-external-cli-made-from-the-operations-list.md`
**Date:** 2026-11-08

There is one new suite and one new helper, the operations suite gains two tests, and none of it needs a stack.

- **`test/external-cli.test.js`, the CLI's suite,** registered in `test/registry.js`. It starts its own instances, runs the CLI as a child process against them, and reads what each instance received.
- **`test/helpers/externalCliServer.js`, a test instance,** run as a child on ephemeral loopback ports. It has:
  - a real express-session (its MemoryStore), the real central auth middleware, the real sign-in handlers (`verify-user`, `login-user`, `logout`), and `registerOperationRoutes` over a fixture catalog;
  - `X-Forwarded-For` on every request before the central check, as nginx sets it, so nothing is trusted as direct-local and the CLI has to sign in;
  - a record of every request it receives (method, path, query, cookie, User-Agent, body);
  - a second port for the suite's own controls (forget every session; forget them before each call; how often each operation ran).

  Two more modes stand in for things that aren't an instance: one answers HTML, the other a 302.
- **`test/operations.test.js` gains H16 and D6,** for the list's `caller` (ADR Decision 7).

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC1: signing in | `S1` an admin key and a URL are enough: one challenge, one signed answer, then the call runs as that admin | `test/external-cli.test.js` | integration (child CLI, child instance) |
| AC1 | `S2` a later call reuses the sign-in: no new challenge, and the stored cookie goes with the call | same | integration |
| AC1 | `S3` after the instance forgets the sign-in, the CLI signs in again exactly once, by itself, and the call succeeds | same | integration |
| AC1 | `S4` a write after a forgotten sign-in runs exactly once (counted on the instance) | same | integration |
| AC1 | `S5` a sign-in that never sticks is retried once, not in a loop: exit 1, at most two sign-ins, the instance's refusal on stdout | same | integration |
| AC1, AC5 | `S6` every sign-in event is kind 22242 with only the challenge tag, the app's content, the key's pubkey and a valid signature; no request carries a secret | same | integration |
| AC2: the operations come from the instance | `O1` `tapestry`, `help` and `--help` list this key's operations by group with summaries, then the CLI's own commands; an admin doesn't see the owner-only one, the owner does | same | integration |
| AC2 | `O2` `tapestry <group>` lists one group | same | integration |
| AC2 | `O3` `<group> <operation> --help` shows inputs, required, the route, a built-in refusal and who may call it, and runs nothing | same | integration |
| AC2 | `O4` one instance has an operation the other hasn't: the same CLI lists and runs it there, and doesn't show it elsewhere | same | integration (two instances) |
| AC2 | `O5` the owner's only operation, or one that doesn't exist, exits 2 naming the instance, the owner, and the operations this key may call, and is never called | same | integration |
| AC2 | `O6` an unknown group exits 2 and names the groups | same | integration |
| AC3: calling | `K1` a read's flags go as the query string and the instance types them; stdout is the JSON answer indented two spaces and nothing else; `--name=value` works | same | integration |
| AC3 | `K2` a write's flags are typed before they go: numbers, booleans and lists in a JSON body | same | integration |
| AC3 (Decision 6) | `K3` fifteen write cases and three read cases answer exactly as the command inside the instance answers them, refusals included | same | integration + in-process internal command |
| AC3 | `K4` unknown, missing and ill-typed inputs come back as the instance's own 400 (its code and input), exit 1, and the call reached the instance | same | integration |
| AC3 | `K5` a declared refusal exits 1, the operation's failure exits 3, each with the instance's JSON; the failure has a reason on stderr | same | integration |
| AC3 | `K6` an instance that can't be reached exits 3, a reason on stderr, nothing on stdout | same | integration (dead port) |
| AC3 | `K7` an answer that isn't JSON exits 3 and says so | same | integration (HTML instance) |
| Decision 4 | `K8` a redirect isn't followed: exit 3 naming its target, and nothing reaches the target | same | integration (redirect + trap) |
| Decision 4 | `K9` a call slower than `TAPESTRY_TIMEOUT` exits 3 within about a second, saying it timed out | same | integration |
| Decision 1 | `K10` the client's `parseFlags` gives the internal command's inputs, help and usage errors for fifteen argument lists | same | unit |
| AC4: the key | `I1` `key new` writes `<home>/key` at 0600 in a 0700 home, prints `{ file, npub, pubkey }` and not the secret, refuses to overwrite, and `--file` writes elsewhere | same | integration |
| AC4 | `I2` `key show` prints `{ source, npub, pubkey }` from a key file, `TAPESTRY_SECRET_KEY` and a signer, never a secret | same | integration |
| AC4 | `I3` a key file others can read is refused (exit 2, naming `chmod 600` and the file) and nothing is sent; at 0600 it works | same | integration |
| AC4 | `I4` `TAPESTRY_SECRET_KEY` as hex or nsec works, and no file in the home holds the secret | same | integration |
| AC4 | `I5` a signer command of the agent's own gets the unsigned sign-in event as one JSON line on stdin, its stderr reaches the agent, the call runs as its key, and the home holds no secret | same | integration (fake signer) |
| AC4 | `I6` a signer returning another challenge, another key's event or a bad signature fails the sign-in (exit 3), and that event is never sent | same | integration |
| AC4 | `I7` two agents' keys in one home: each call runs as its own key, and each key signs in exactly once | same | integration |
| AC4 | `I8` the instance comes from `--instance`, then `TAPESTRY_INSTANCE`, then `tapestry use`; alternating two instances signs in to neither again | same | integration (two instances) |
| AC4 | `I9` the home and everything in it are readable only by the agent's user | same | structural (after the calls) |
| Decision 4 | `I10` plain http to another host exits 2 asking for https, a URL with a path exits 2, nothing is sent; http to 127.0.0.1 works | same | integration |
| AC4 | `I11` `whoami` says owner or admin (exit 0, with npub, pubkey and instance); for a key that's neither, exit 1, `role: neither`, and stderr names the npub, the instance and the owner making it an admin | same | integration |
| AC4 | `I12` a key that's neither is told so on `tapestry` and on an operation, exit 1, never an empty list | same | integration |
| AC4 | `I13` no key: exit 2 naming `tapestry key new` and `TAPESTRY_KEY_FILE`, nothing sent; no instance: exit 2; `help` works with nothing set up | same | integration |
| AC4 | `I14` `login` signs in afresh and gives the role; `logout` posts `/api/auth/logout` with the cookie; the next call signs in again | same | integration |
| AC4 | `I15` three runs started at once by one agent all succeed, and a later run reuses what they kept | same | integration |
| AC5 | `A1` every request any instance got was the sign-in or under `/api/tapestry/`, each with `User-Agent: tapestry-operations-cli/<version>` | same | integration (all records) |
| AC5, AC1 | `A2` the only signed events sent were kind-22242 sign-ins to `login-user`; no other request carried a signature; no request anywhere carried a secret | same | integration (all records) |
| AC5 | `A3` the CLI's code loads no WebSocket, relay, pool or NIP-46 module | same | structural |
| AC6: the skill | `SK1` `clients/cli/skill/SKILL.md` has frontmatter `name: tapestry-operations`, a description, and OpenClaw's `requires.bins: [tapestry]` | same | structural |
| AC6 | `SK2` the skill covers each topic the story lists, and the cold start runs `whoami` before `lifecycle status` | same | structural |
| AC6 | `SK3` the skill and `src/commands.js`'s tables agree on commands, global flags, environment variables and exit codes, and the skill shows no `tapestry …` word, flag or variable the CLI lacks, and names no operation but `lifecycle status` | same | structural |
| AC6 | `SK4` the CLI's own help names every table command, and an unknown word exits 2 | same | integration |
| Decision 1 | `P1` `clients/cli/package.json`: `tapestry-operations-cli`, private, `bin.tapestry`, Node `>=20`, only ajv and nostr-tools at the root lockfile's exact versions; a lockfile beside it | same | structural |
| Decision 1 | `P2` `bin/tapestry.js` has a node shebang and is executable | same | structural |
| Decision 2 | `P3` `--version` prints `tapestry <version>` and `/api/tapestry/`, with no key or network | same | integration |
| Decision 10 | `P4` `.dockerignore` lists `clients/`, and nothing in `src/` or `bin/` requires the client | same | structural |
| Decision 9 | `P5` the README covers `npm ci`, `npm link`, `which -a tapestry` and the skill | same | structural |
| Decision 7 | `H16` the list's `data.caller` is `{ role, pubkey }` for the owner and an admin, and `{ role: 'local', pubkey: null }` for a direct-local caller | `test/operations.test.js` | integration (its harness) |
| Decision 7 | `D6` the list's `/docs` entry names `caller` in its 200 answer | `test/operations.test.js` | unit |
| AC7: end to end | the live check below | — | live (Implementation's verification, not a gate suite) |

## Pinned by this plan

The ADR leaves these to the tests. The Implementer builds to them.

- **The tables' shape.** `clients/cli/src/commands.js` exports `{ COMMANDS, GLOBAL_FLAGS, ENV, EXIT_CODES }`:
  - `COMMANDS` is a list of `{ words: string[], flags?: string[] }`, for example `{ words: ['key', 'new'], flags: ['--file'] }`;
  - `EXIT_CODES` is `{ 0: 'answered', 1: 'refused', 2: 'usage', 3: 'failed' }`.
- **The parser.** `clients/cli/src/flags.js` exports `parseFlags(args)`, which returns `{ inputs, help }` or `{ usage }`, as the internal one does.
- **What the CLI's own commands print,** each a JSON object on stdout:
  - `key new`: `{ file, npub, pubkey }`;
  - `key show`: `{ source, npub, pubkey }`, where `source` names the key file's path, `TAPESTRY_SECRET_KEY` or the signer;
  - `whoami`: `{ instance, npub, pubkey, source, role }`, where `role` is `owner`, `admin` or `neither`;
  - `use`: `{ instance }`;
  - `login`: an object with `role`.
- **Exit codes for the CLI's own failures:**
  - a key file others can read: 2;
  - `key new` onto an existing file: non-zero, with the file named on stderr;
  - a signer's wrong or unverifiable event: 3, and it is never sent.
- **`TAPESTRY_TIMEOUT`** is in seconds.

## Edge cases

- [x] An instance that forgets every sign-in (`S3`, `S4`), and one where a sign-in never sticks (`S5`).
- [x] A write retried after a 401 runs once, not twice (`S4`).
- [x] Two keys in one home (`I7`), one key on two instances (`I8`), and three runs at once (`I15`).
- [x] A loose key file (`I3`), a key given as hex and as nsec (`I4`), and a signer that lies (`I6`).
- [x] Not an instance (`K7`), a redirect (`K8`), no answer (`K6`), too slow (`K9`).
- [x] A key that signs in but is neither owner nor admin (`I11`, `I12`).
- [x] Nothing set up (`I13`), help with nothing set up (`I13`, `SK4`).
- [x] Every "never" assertion is paired with one that the path ran:
  - `S6` and `A2` (no secret sent) check that sign-ins were sent;
  - `I3` and `I13` (nothing sent) send a working call beside them;
  - `I6` (event never sent) checks the signer was asked;
  - `K8` (nothing reached the target) checks the redirecting address was called;
  - `A1` and `A3` check that requests were made and files were found.
- [ ] **Not covered:** an instance whose list has a group named like one of the CLI's own commands (ADR Decision 2). Today's groups can't take those names, and making the case means a hand-made list served by a stub instance. Low value now.
- [ ] **Not covered:** https itself. The suite's instances are plain http on loopback, which the CLI allows. The live check covers a real proxy path.

## Test infrastructure

- **Runner:** the Node gate (`node test/test.js`, `npm test`), with the suite in `test/registry.js`. Read a run per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate). The suite also runs alone: `node test/external-cli.test.js`.
- **Stack:** none. Each instance is a child on 127.0.0.1 with dead Neo4j, Redis and HTTP endpoints, configured through `BRAINSTORM_CONF_PATH` (the owner) and `TAPESTRY_SETTINGS_PATH` (the admin), as `test/operations.test.js` does. Nothing reaches a live instance, and the screen for `docker exec`, `TAPESTRY_PORT` and `:7778` finds nothing in either suite.
- **The CLI's environment** is only `PATH`, a temporary `HOME`, the agent's `TAPESTRY_HOME`, and what a test passes. It finds nostr-tools and ajv in the root's `node_modules`, so CI's root `npm ci` is enough.
- **Keys** are made fresh in the suite (owner, admin, stranger). The fake signer is a script written into a temporary folder that signs with a key file only it reads.
- **Fixtures:** a catalog written at run time:
  - `graph echo-inputs`, a read with typed inputs;
  - `graph write-thing`, a write with integer, number, boolean, list, string and object inputs;
  - `graph refusing`, a declared 404 or a 500;
  - `graph slow`;
  - `lifecycle owner-thing`, owner only;
  - and, on the second instance only, `graph added-later`.
- **Firmware state:** not needed.

## How to run

```
node test/external-cli.test.js
node test/operations.test.js
```

or the whole gate, `npm test`, in CI. On this machine the full gate isn't run, because some of its live suites can reach a private instance here.

## The live check (AC7) — Implementation's verification

- **Where:** on a scratch stack (`scripts/scratch-stack.sh`), never on a shared or private instance.
- **The path:** one where the instance doesn't trust the caller as local, so the sign-in is really exercised: through nginx, or a port published on 127.0.0.1.
- **The steps:**
  1. With a fresh `TAPESTRY_HOME`, run `tapestry key new`.
  2. The owner adds that npub as an admin. Inside the container, as a local caller, that is `POST /api/admin/add`.
  3. Run `tapestry whoami`, then `tapestry`, then every listed operation (today `lifecycle status`) through the CLI, and compare each answer with `docker exec … tapestry <group> <operation>` inside the container.
  4. Run `tapestry whoami` with a second, unlisted key, which must say `neither`.
- **Recorded:** in the story's Evidence.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-08 on branch `A10.6-external-cli-skill` at `460a723f3` plus this phase's uncommitted files, on Node 24.18.0.

`node test/external-cli.test.js`, exit 1: 0 passed, 49 failed. The instances started, and every test failed because the feature isn't built:

```
  35 clients/cli/bin/tapestry.js does not exist yet (ADR graph-operations-foundation/0006 Decision 1)
   3 clients/cli/skill/SKILL.md does not exist yet (ADR graph-operations-foundation/0006 Decision 8)
   2 clients/cli/package.json does not exist yet (ADR graph-operations-foundation/0006 Decision 1)
   1 clients/cli/src/flags.js does not exist yet (ADR graph-operations-foundation/0006 Decision 1)
   1 clients/cli/src/commands.js does not exist yet (ADR graph-operations-foundation/0006 Decision 1)
   1 clients/cli/README.md does not exist yet (ADR graph-operations-foundation/0006 Decision 1)
   1 clients/cli/src and bin must hold the CLI; found 0 files
   1 .dockerignore must list clients/
   1 the suite's calls so far must have signed in; got 0 sign-ins
   1 the suite's calls must have reached the instances; got 0 requests
   1 the suite must have signed in several times; got 0
   1 the admin agent's home must hold its sign-in by now; found []
```

`node test/operations.test.js`, exit 1: 46 passed, 2 failed. Its per-operation suite passed 7 of 7.

```
  FAIL  H16: the list names its caller: … (graph-operations-foundation #6, ADR 0006 Decision 7)
        h13-list-owner: the list's data.caller must be {"role":"owner","pubkey":"aaaa…"}, so a client can tell the owner from an admin; got undefined
  FAIL  D6: the list route's /docs entry describes the caller it names (graph-operations-foundation #6, ADR 0006 Decision 7)
        GET /api/tapestry/operations's 200 response must name data.caller beside operations and problems; got "{ success: true, data: { operations, problems } }"
```

`test/stack-free-npm-test.test.js`, run through its `run()` with dead endpoints: 6 passed, 0 failed, 1 skipped, so G5 accepts the new registry line.

**The tests can pass.** A throwaway probe, kept in the scratchpad and not committed, drove the test instance by hand through nostr-tools:
- the admin signed in with real cookies through `verify-user` and `login-user`;
- the list answered 200, without `caller` yet, and a call came back typed as the admin;
- a visitor got 401, and so did the admin after `/forget`;
- a key that's neither signed in, then got 403 on the list;
- after the owner's `logout`, the list answered 401;
- every request was recorded with its body.
