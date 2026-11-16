# The external CLI: `tapestry` on your own machine

`tapestry` signs in to a Tapestry instance with your own nostr key, made an admin there by the instance's owner. It reads the instance's own list of operations (`GET /api/tapestry/operations`) and calls them by group and name. It defines no operations, so it works with whatever operations each instance has, the day they land.

- **Design:** ADR [`graph-operations-foundation/0006`](../../engineering-team/decisions/graph-operations-foundation/0006-external-cli-made-from-the-operations-list.md).
- **Story:** [`graph-operations-foundation` #6](../../engineering-team/stories/graph-operations-foundation/6-external-cli-and-agent-skill.md), Loom A10.6.
- **The design doc's D14:** a thin client, made from the instance's declarations.

## Install, from a checkout of this repo

Node 20 or later.

```
which -a tapestry
cd clients/cli
npm ci --omit=dev
npm link
tapestry --version
```

- **`which -a tapestry` first.** If another `tapestry` is already on your PATH (an older Tapestry CLI, say), decide whether to remove it, with the npm that installed it, before `npm link`.
- **`npm ci` installs only this folder's two dependencies,** nostr-tools and ajv, and none of the server's.
- **`npm link`** puts `tapestry` on the PATH of the npm's node you run it with.

## Use

```
tapestry key new                     # a key of your own, if you have none; give its npub to the owner
tapestry use https://tapestry.example.com
tapestry whoami                      # owner, admin or neither
tapestry lifecycle status
tapestry                             # every operation you may call here
tapestry <group> <operation> --help
tapestry <group> <operation> --name value
```

The key can also come from `--key-file <path>` or `TAPESTRY_KEY_FILE`, from `TAPESTRY_SECRET_KEY`, or from a signer command of your own (`TAPESTRY_SIGNER` with `TAPESTRY_PUBKEY`), which gets the unsigned sign-in event on stdin and prints the signed one. The key signs only the instance's sign-in challenge, and the CLI never stores, prints or sends it.

- **Exit codes,** as with the internal command: 0 answered, 1 refused, 2 usage, 3 failed.
- **Output:** stdout carries only the instance's JSON answer.

## What it keeps

`TAPESTRY_HOME`, by default `~/.config/tapestry`, readable only by you, holds:

- `sessions.json`: the sign-ins, per instance and key;
- `config.json`: the default instance;
- `key`: the key `tapestry key new` made, if it made one.

If several agents share one machine user, give each its own `TAPESTRY_HOME`.

## The agent's skill

[`skill/SKILL.md`](skill/SKILL.md) tells an agent how to use the CLI. Link the folder into the agent's skills:

- **Claude Code:** `ln -s "$PWD/skill" ~/.claude/skills/tapestry-operations`
- **OpenClaw:** `ln -s "$PWD/skill" ~/.openclaw/workspace/skills/tapestry-operations`

The skill names no operation but `lifecycle status`, because the CLI lists them. A test (`test/external-cli.test.js`, SK1–SK4) keeps the skill and the CLI's own command table, `src/commands.js`, in step.

## Tests

From the repo root, `node test/external-cli.test.js`. It needs no stack: it starts loopback test instances of its own. CI runs it in the gate.
