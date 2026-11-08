# ADR 0006: The external CLI — a thin client made from the instance's list of operations, with the agent's skill beside it

**Status:** Accepted
**Date:** 2026-11-08
**Story:** `engineering-team/stories/graph-operations-foundation/6-external-cli-and-agent-skill.md`

*Numbered 0006 to match story 6 and Loom A10.6, as the story is numbered by its Loom task (the epic's numbering note).*

## Context

The story (Loom A10.6) asks for the agent's way into the graph operations, in short:

- **AC1** The CLI signs in with the agent's own key through the instance's existing signed-challenge sign-in, reuses that sign-in, and signs in again once by itself when the instance stops accepting it. The key signs only the challenge and is never sent.
- **AC2** `tapestry`, `tapestry <group>` and `tapestry <group> <operation> --help` come from the instance's own list, so a new operation needs no change to the CLI. An operation the list doesn't give this key exits 2.
- **AC3** `tapestry <group> <operation> --name value …` calls the route with the internal command's flags, each value reaching the instance as its declared type, and prints the instance's JSON as it came, alone on stdout. Exit codes 0, 1, 2 and 3, as inside.
- **AC4** How an agent keeps its key is its own business: the CLI reads the key, or has the agent's own signer sign. It never stores, prints or sends the key, and refuses a key file others can read. It can make a key. Each agent's calls go out under its own key and sign-ins. The agent names the instance or sets a default, can ask who it is there (owner, admin or neither), and is told plainly when its key is neither.
- **AC5** Only the sign-in and the routes under `/api/tapestry/`. The key signs nothing but the challenge, and nothing is published to a relay.
- **AC6** A skill, in the format Claude Code and OpenClaw load, that lists no operation by hand, with a test that keeps it in step with the CLI.
- **AC7** End to end on a scratch stack: an agent with only its key, the URL and the skill calls every admin operation.

**Orientation.** The story changes no concept, so the concept graph wasn't consulted and no handle is cited. The stack answering at `localhost:7778` on this machine is a private agent-memory instance, not the dev stack, and nothing here touches it.

**What binds the design.**

- **D14** (design doc): a thin client in this repo that defines no operations, signs in with the agent's own key, reads the list from the instance it's talking to, and turns each operation into `tapestry <group> <operation>`. An MCP server comes later, made the same way. **D15:** the old tools keep working.
- **The planning gate's answers** (story, "Open questions"): each agent protects its own key, as any nostr user does, so the CLI takes the key however the agent's setup gives it; and agents get the CLI from this repo.
- **ADR 0001** (story 1): the list (Decision 8), the internal command's flags, output and exit codes (Decision 7), input checking (Decision 5) and the router's re-check (Decision 3).

**Facts from the code.**

1. **Sign-in.** `POST /api/auth/verify-user {pubkey}` answers a 32-byte challenge and keeps it, pending, in the caller's session (`src/middleware/auth.js:412–453`). `POST /api/auth/login-user {event}` accepts kind 22242 or 27235, the same pubkey, the challenge as a `challenge` tag, a `created_at` within 600 s, and a valid signature, then regenerates the session, which gives a new cookie (`:20–44`, `:459–506`).
   - Sessions are express-session in Redis, cookie `connect.sid`, 30 days, `secure` only under `USE_HTTPS` (`bin/control-panel.js:232–241`).
   - The React app signs `{ kind: 22242, tags: [['challenge', c]], content: 'Tapestry authentication' }` (`ui/src/context/AuthContext.jsx:118–124`).
2. **Owner and admins.** The owner is `BRAINSTORM_OWNER_PUBKEY`. The admins are `settings.json`'s `adminPubkeys`, else `BRAINSTORM_ADMIN_PUBKEYS` (`src/utils/config.js:106–119`, with `TAPESTRY_SETTINGS_PATH` to move the file). Both are read again on every request (`auth.js:277–285`, `src/operations/http.js:20–29`), so removing an admin stops its sign-in at once. The owner adds an admin with `POST /api/admin/add` (owner only), on `/pages/manage/manage-administrators.html`.
3. **What a caller is told.** The central check answers 401 "Sign in as the owner or an admin to do this." and 403 "Only the owner or an admin can do this." with no `code`. The router's own re-check adds `code: 'sign-in-required' | 'not-allowed'` (`http.js:31–40`). An unknown path under the prefix falls through to Express's HTML 404.
4. **The list says nothing about the caller.** `GET /api/tapestry/operations` answers `{ success, data: { operations, problems } }`, filtered by caller (`http.js:61–70`). Nor can the sign-in routes tell an owner from an admin: their `isOwner` is true for both (`auth.js:445`, `:497`), and only verify-user's human `message` differs (`:446`).
5. **Inputs.** A read's query string is coerced by the text checker (`coerceTypes: 'array'`). A write's JSON body is not coerced at all (`src/operations/inputs.js:10–11`). So a client that turns `--limit 5` into a write must type the value itself, as the text checker would.
6. **The internal command** (`src/operations/cli.js`):
   - Its `parseFlags` (`:65–82`) takes `--name value` or `--name=value`, makes a flag with no value true and a repeated flag a list, and refuses a stray word.
   - It prints the route's JSON alone on stdout, and exits 0 when answered, 1 when refused, 2 for usage and 3 for a failure.
7. **Dependencies the root already pins:** nostr-tools 2.10.4 (CommonJS, exporting `./pure` and `./nip19`) and ajv 8.18.0.
8. **The image.** `publish-image.yml` rebuilds and rolls the brain images on a push to staging that touches `src/**`, `.dockerignore`, `Dockerfile` and some other paths, but not `clients/**`. `.dockerignore` already keeps the launcher (`deploy/`) out of the image.
9. **Precedents.**
   - Vinney's `brain login` (story, Background): the same two sign-in calls, a cookie file readable only by its user, and the signature from `nak`, through a remote signer, a key pasted once, or an environment variable.
   - Loom's CLI: `LOOM_CONNECTION_FILE` gives a second Claude on one computer its own connection file, and it refuses a config file that other users can read.
10. **A name already taken on this Mac.** `/opt/homebrew/bin/tapestry` is the owner's March tapestry-cli, a global install of the package `tapestry-cli` under Homebrew's npm. No active skill uses it: OpenClaw mentions it only in February and March logs.

## Options considered

### Option A — A standalone client package in `clients/cli/`, made from the list each time it runs

A folder with its own `package.json`, lockfile and two dependencies (nostr-tools to sign, ajv to type inputs the way the instance's text checker does). It reads the list on every run, keeps a sign-in per agent and instance, and copies the internal command's flag rules, with a test that holds the copy to the original. The skill sits in the same folder.

- **Pros.** It installs from a checkout without the server's dependencies, as the story asks. It defines nothing about any operation, so it can't fall out of step with an instance. It can be read as a library, which a later MCP server can reuse.
- **Cons.** The flag parser exists twice, held equal by a test rather than by construction. The client's dependency versions are pinned beside the root's and must be bumped with them.

### Option B — A remote mode for the internal command

`tapestry --instance <url> …` in `bin/tapestry.js` would call routes instead of the module in-process, so the two commands would share their parser, listing and help by construction.

- **Pros.** One parser, and one help format.
- **Cons.**
  - `src/operations/cli.js` loads the catalog, the declaration rules and ajv, and lives in the server's package, so an agent would install the server's dependency tree (lmdb, neo4j-driver, bullmq…). Running remote mode without loading those means reorganizing story 1's module around a second use.
  - The in-container command must keep needing no sign-in. Mixing a signed-in remote path into it puts the two trust levels in one code path.

### Option C — One file with no dependencies

A single script an agent copies, signing with a BIP-340 Schnorr signer written by hand on Node's BigInt and `crypto`.

- **Pros.** Nothing to install.
- **Cons.** Hand-written signing code (not constant-time, a correctness risk, and a review burden on every change), and each agent carries its own copy with no way to update it.

## Decision

We chose **Option A**, because it is the only option that installs without the server and still lets nothing about an operation live in the client. The rest of this section says exactly how.

**1. Layout.** One folder, `clients/cli/`, that nothing in the server loads:

| File | What it does |
|---|---|
| `package.json` | `name: "tapestry-operations-cli"`, `private: true`, `bin: { "tapestry": "bin/tapestry.js" }`, `engines.node: ">=20"`, `dependencies`: nostr-tools `2.10.4` and ajv `8.18.0`, exactly the root's |
| `package-lock.json` | its own lockfile |
| `bin/tapestry.js` | `#!/usr/bin/env node`; calls `main(argv, io, env)`, then exits in stdout's write callback, as the internal command does |
| `src/main.js` | the dispatch: the CLI's own commands, or an operation |
| `src/flags.js` | the copy of the internal command's flag rules |
| `src/identity.js` | which key, from where, its public key; `key new`, `key show` |
| `src/signin.js` | the handshake, and asking a signer command to sign |
| `src/sessions.js` | the sign-ins kept, per instance and key |
| `src/instance.js` | which instance, its URL rules, and the HTTP calls |
| `src/operations.js` | the list, listing and help, building a call, typing write inputs |
| `src/commands.js` | the CLI's own commands, global flags, environment variables and exit codes as data, which the skill's test reads |
| `README.md` | install and use, for people |
| `skill/SKILL.md` | the agent's skill |

The package name avoids `tapestry-cli`, the March CLI's, so uninstalling one never removes the other.

**2. The command line.**

```
tapestry [--instance <url>] [--key-file <path>] <command…>
tapestry                                   the instance's operations for this key, by group, then the CLI's own commands
tapestry <group>                           one group's operations
tapestry <group> <operation> --help        its inputs, result, refusals, who may call it and its route
tapestry <group> <operation> [--name value …]   call it
tapestry whoami | login | logout           who this key is on the instance; sign in now; sign out
tapestry use <url>                         set the default instance
tapestry key new [--file <path>] | key show
tapestry help | --help | -h | --version
```

- **Global flags come before the command words.** Everything after `<group> <operation>` is that operation's inputs, parsed exactly as the internal command parses them, so an operation may declare an input named `instance` without a clash.
- **Reserved words.** `whoami`, `login`, `logout`, `use`, `key` and `help` are the CLI's own. None is a group: the groups are fixed by D1 in `src/operations/groups.js`. If an instance's list ever has a group of one of these names, the CLI says on stderr that the group can't be reached by this CLI, and carries on.
- **Output.** Listings and help are text, as inside. An operation's answer is the instance's JSON body, indented two spaces, alone on stdout. The CLI's own commands print a JSON object on stdout. Everything else goes to stderr.
- **Exit codes**, the internal command's: 0 answered, 1 refused (the instance's 4xx, or a key that's neither owner nor admin), 2 usage (an unknown command, group or operation, a stray word, no instance, no key), 3 failed (the instance's 5xx, an instance that can't be reached, or an answer that isn't JSON).
- **`--version`** prints `tapestry <version> — the external CLI for a Tapestry instance's operations (/api/tapestry/)`, so an agent can tell it from another program of the same name.

**3. The identity: whose key, and where its sign-ins live.**

- **The home.** `TAPESTRY_HOME`, by default `~/.config/tapestry`. The CLI creates it, readable only by its user (0700), when it first writes there. It holds `config.json` (optional), `sessions.json` and, if the CLI made one, `key`. One agent per home is the rule: several agents on one machine user each set their own `TAPESTRY_HOME`, as Loom's `LOOM_CONNECTION_FILE` does.
- **Where the key comes from,** the first of these that is set:
  1. `--key-file <path>`;
  2. `TAPESTRY_KEY_FILE`;
  3. `TAPESTRY_SECRET_KEY`, for an agent whose secrets arrive in its environment;
  4. `TAPESTRY_SIGNER`, a command of the agent's own that signs (below), with `TAPESTRY_PUBKEY`;
  5. `config.json`'s `keyFile`, or its `signer` with `pubkey`;
  6. `<home>/key`, if it exists.

  With none of them set, a command that needs the key exits 2 and says how to set one up.
- **A key** is an `nsec1…` or 64 hex characters, with whitespace trimmed. A key file must be a regular file that no other user can read (`mode & 0o077 === 0`, as ssh insists for a private key), or the CLI refuses it, naming `chmod 600 <path>`. The file is read on each run to learn the public key, and the secret is used only to sign the sign-in challenge. It is never stored by the CLI, printed, logged or sent.
- **A signer command** is run through `/bin/sh -c` only when a sign-in is needed:
  - The unsigned sign-in event, as one line of JSON with `pubkey` set, goes on its stdin.
  - The signed event is read from its stdout, as the first line that parses as a JSON object.
  - Its stderr passes through, so a signer's prompts reach the agent or its person, and it has 180 seconds.
  - The CLI then checks the returned event: a valid signature, and the same kind, tags, content and pubkey it asked for. Otherwise the sign-in fails.
  - For example, `TAPESTRY_SIGNER='nak event --sec bunker://…'` signs through a NIP-46 remote signer, as Vinney's `brain` does, while the CLI itself never opens a relay connection (AC5).
- **`key new`** makes a key with nostr-tools' `generateSecretKey`, writes its `nsec` to `<home>/key`, or `--file`, with mode 0600 and flag `wx` (it never overwrites a file), and prints `{ file, npub, pubkey }`. `key show` prints the identity's `{ source, npub, pubkey }`, where `source` names a file, a variable or the signer, never a secret.
- **Sign-ins** are kept in `<home>/sessions.json` (0600), keyed by the instance's origin and then by the pubkey: `{ version: 1, sessions: { "<origin>": { "<pubkey hex>": { cookie, expires, signedInAt } } } }`. Each write goes to a temporary file that is then renamed. Because sign-ins are found by pubkey, a run with one agent's key never picks up another key's sign-in.

**4. The instance.**

- **Which one:** `--instance`, then `TAPESTRY_INSTANCE`, then `config.json`'s `instance`, which `tapestry use <url>` writes. With none set, the command exits 2.
- **URL rules.** The URL is an origin, with no path, query or fragment. It must be `https`, except that `http` is allowed for loopback hosts (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`), because the sign-in's cookie must not cross a network in clear text.
- **Calls** use Node's `fetch` with `redirect: 'manual'`: a redirect fails, naming its `Location`, so a cookie or a signed challenge never follows it to another host. Each call has a timeout of `TAPESTRY_TIMEOUT` seconds, 300 by default, since a backup may run long. Every call sends `User-Agent: tapestry-operations-cli/<version>` and `Accept: application/json`.

**5. Signing in.**

1. `POST /api/auth/verify-user` with `{ pubkey }`. Keep the `connect.sid` cookie from `Set-Cookie`, read with `headers.getSetCookie()` (hence Node 20).
2. Sign `{ kind: 22242, created_at: now, tags: [['challenge', challenge]], content: 'Tapestry authentication', pubkey }`: with the key, using nostr-tools' `finalizeEvent`, or with the signer command.
3. `POST /api/auth/login-user` with `{ event }` and that cookie. Store the new cookie from its `Set-Cookie`, since the session was regenerated.

- **When.** On the first call that needs a sign-in, or by `tapestry login`. A 401 from the list or from an operation drops the stored sign-in, signs in once, and retries the call once. A 401 is answered before the operation runs, so a write is never sent twice. A second 401 is a refusal.
- **A refusal at the sign-in** (`authorized: false`, a non-success login, or any 4xx) exits 1, with the instance's message. A 5xx or no answer exits 3.

**6. The list and the operation commands.**

- **The list, once per run.** Each run that needs operations fetches `GET /api/tapestry/operations` once. So a new operation appears the day it lands (AC2), at the cost of one small request per run.
- **Listing and help** follow the internal command's layout (`cli.js:25–63`). There are no group descriptions, because the list doesn't carry them, and the help says how this key may call the operation in place of the in-container note. A footer lists the CLI's own commands.
- **Not in the list:** an unknown group or operation exits 2. It says the operation isn't among those this key may call on this instance (it may not exist there, or it may be the owner's only), and lists the ones it may.
- **Building the call** from the list entry's `method`, `route` and `inputs`:
  - **A read (`GET`):** the flags become the query string as text, a flag with no value as `true` and a list as repeated keys. The instance's text checker types them, as it does for the internal command.
  - **A write (`POST`):** the flags are typed before they are sent. ajv runs with the text checker's options (`coerceTypes: 'array'`, `allErrors: true`, `strict: false`, no defaults) on a copy, against an object schema built from the entry's inputs with extra properties allowed. A value it can't type, and an input the operation doesn't declare, go as they came, so that the instance refuses them (`invalid-input`, `unknown-input`). The instance stays the only judge of inputs.
- **The answer.** The JSON body is printed as it came. A 403 from an operation adds one stderr line saying whether the key is neither owner nor admin, or the operation is the owner's only. An answer that isn't JSON exits 3, and its status and first bytes go to stderr.

**7. Who the key is: the list names its caller.** This is the one change on the instance's side, raised at this gate as the story asks.

- **The change.** `GET /api/tapestry/operations` adds `data.caller = { role, pubkey }`, where `role` is `owner`, `admin` or `local`. `listHandler` already holds the caller (`http.js:61–68`). The addition is additive, since no client reads the list yet, and the list's `/docs` entry describes it.
- **`tapestry whoami`** signs in if it must, reads the list, and prints `{ instance, npub, pubkey, source, role }`, exiting 0. A 403 there means the key signed in but is neither owner nor admin: `role` is `neither`, exit 1, and a stderr line names the npub and the instance and says the owner can make the key an admin on the instance's administrators page. Every operation command gives the same message on the same 403.
- **The alternative,** reading "Owner" or "Admin" out of verify-user's human `message`, needs no change on the instance but leans on a sentence meant for people.

**8. The skill.** `clients/cli/skill/SKILL.md`, which an agent links into its skills folder (Claude Code: `~/.claude/skills/tapestry-operations`; OpenClaw: its workspace's `skills/tapestry-operations`).

- **Frontmatter:** `name: tapestry-operations`; a `description` that says when to use it (reading or changing a Tapestry instance's concept graph as an admin agent, through the `tapestry` CLI); and `metadata` with OpenClaw's `{"openclaw":{"requires":{"bins":["tapestry"]}}}`.
- **Body,** in the story's order:
  - what the operations are for;
  - installing the CLI, then checking `tapestry --version`;
  - its key: `key new`, or pointing the CLI at a key it keeps, in whichever way it keeps it, with one `TAPESTRY_HOME` per agent on a shared machine user;
  - having the owner make the key an admin;
  - choosing the instance;
  - the cold start: `tapestry whoami`, then `tapestry lifecycle status`, then `tapestry`;
  - finding operations and reading `--help`;
  - answers, refusals and exit codes;
  - what never to do.
- **It names no operation but `lifecycle status`,** the one every instance has (story 1).
- **The test that keeps it honest** (AC6) reads `src/commands.js`'s tables and the skill's text. It fails when:
  - the skill names a CLI command, global flag, environment variable or exit code that isn't in the tables;
  - the tables hold one that the skill never names;
  - the skill's exit codes don't say what the tables say.

**9. Installing it.** From a checkout: `cd clients/cli && npm ci --omit=dev && npm link`, which puts `tapestry` on the PATH of that npm's node. The README and the skill say to run `which -a tapestry` first. If another `tapestry` is there, such as the March `tapestry-cli`, the person decides whether to remove it, with the npm that installed it. `npm ci` in this folder installs only the two dependencies.

**10. Out of the instance's image.** `.dockerignore` gains `clients/`, beside `deploy/`. The CLI isn't the instance's code, and leaving it in would change the image whenever only the client changes.

## Consequences

**What this enables**

- Every A10 operation can be called from an agent's own machine the day it lands, with no change to the client. The owner can use the same CLI with their own key.
- Agents keep their keys however their setups do: a file, their environment, or a signer of their own, including a NIP-46 bunker through `nak`.
- The client is a library with a thin `bin`, so the later MCP server can reuse its identity, sign-in, list and call code.

**What this constrains**

- `whoami`, `login`, `logout`, `use`, `key` and `help` are reserved. A future group can't take one of those names.
- The client's two dependency pins follow the root's. A test holds its flag rules and its typing of write inputs to the instance's.
- Every run makes one extra request, for the list.

**New debt and follow-ups**

- **The brains roll once.** The list's `caller` touches `src/operations/http.js` and `openapi.js`, and `.dockerignore` changes too, so merging to staging rolls the brain images, as story 1 did.
- **On this Mac,** installing the CLI under nvm's npm puts its `tapestry` ahead of Homebrew's March `tapestry-cli` in interactive shells, but not necessarily in an agent's non-interactive shell. Removing the old one is the owner's call (asked at this gate).
- **Nothing on the agent's machine records the calls an agent made.** Who changed what is recorded on the instance, by the write path (A10.4).
- **Not built here:** a NIP-46 client inside the CLI (the signer command covers it), an npm package, and a hosted copy.

**Firmware reinstall required?** No: no concept changes.

## Implementation notes

**New files:** `clients/cli/`, as Decision 1 lists. The skill and the README are written against `src/commands.js`, so the two can't drift without its test failing.

**Changed files**

- `src/operations/http.js`: `listHandler` answers `data: { caller: { role: caller.role, pubkey: caller.pubkey }, operations, problems }`.
- `src/operations/openapi.js`: `listEntryDoc()`'s description and its 200 line name `caller`.
- `.dockerignore`: add `clients/`, with a comment naming this ADR.

**For the Tester** (Phase 3: these test changes are the Tester's, not the Implementer's)

- **A new top-level suite** for the CLI, added to `test/registry.js`, which exports `run()` and needs no stack.
  - **A real HTTP app on loopback** in the suite: express-session with its MemoryStore, `express.json()`, the real `handleAuthVerifyUser` and `handleAuthLoginUser`, and `registerOperationRoutes(app, { dir })` over a fixture catalog: a read with typed inputs, a write with typed inputs, and an owner-only operation.
  - **The owner and the admin** come from `BRAINSTORM_OWNER_PUBKEY` and a `settings.json` at `TAPESTRY_SETTINGS_PATH`, with keys made in the suite.
  - **The CLI runs as a child process,** `node clients/cli/bin/tapestry.js`, with a temporary `TAPESTRY_HOME` and `TAPESTRY_INSTANCE=http://127.0.0.1:<port>`. It finds its dependencies in the root's `node_modules`.
- **What the suite covers:**
  - each AC;
  - sign-ins counted, to show reuse, and the one re-sign-in after the app forgets a session;
  - every request recorded, to show only the sign-in and `/api/tapestry/` are reached and that no request carries the secret;
  - a key file others can read, refused;
  - a fake signer command, a small script that signs with a test key, and one that returns the wrong event;
  - two keys in one home, never sharing a sign-in;
  - a signed-in key that is neither owner nor admin, exit 1 with the message;
  - unknown group or operation, exit 2;
  - a dead port, exit 3;
  - the `--version` banner.
- **Parity tests:**
  - the client's `parseFlags` against `src/operations/cli.js`'s on one table of argument lists;
  - a write's typed body against what the instance's text checker makes of the same flags.
- **The skill's test** (Decision 8).
- **The list's `caller`** in the operations suite (`test/operations.test.js`), for the owner, an admin and a local caller.
- **The live check (AC7)** is part of Implementation's verification, not a gate suite. It runs on a scratch stack (`scripts/scratch-stack.sh`), never on a shared or private instance, and goes through a path where the instance doesn't trust the caller as local (through nginx, or a port published on loopback), so the sign-in is really exercised. The owner adds the agent's new key as an admin, and the CLI on the host calls `whoami`, `tapestry` and every listed operation.

**Branches.** A new feature for `staging` only. It reaches `main` through the normal promotion, and no long-lived sandbox branch needs a port.

## Out of scope

- An MCP server (D14, later).
- A NIP-46 client inside the CLI, a hosted copy of the CLI, and publishing it to a package registry.
- Group descriptions in the list, a JSON 404 for unknown paths under the prefix, and codes on the central check's 401 and 403 (ADR 0001 left those out too).
- Any change to the instance's sign-in, or to who may call what.
- A record of calls on the agent's machine.
- Removing the March `tapestry-cli` from any machine.
