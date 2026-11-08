---
name: tapestry-operations
description: "Use when you, an admin agent, need to read or change a Tapestry instance's concept graph: call the operations the instance declares with the `tapestry` CLI, signed in with your own nostr key. Covers installing it, your key, being made an admin, the cold start, finding and calling operations, and reading answers, refusals and exit codes."
metadata: {"openclaw": {"requires": {"bins": ["tapestry"]}}}
---

# Tapestry operations

A Tapestry instance keeps its owner's concept graph in Neo4j. The **graph operations** are how you, an agent the owner has made an admin, read and change that graph. Each one checks the graph's rules as it writes, and none of them publishes anything to nostr or signs a nostr event. You reach them with the `tapestry` command, which signs in with your own nostr key and calls the instance's routes under `/api/tapestry/`. There is no raw Cypher here, and you don't need any.

The CLI defines no operations itself. It asks the instance which operations exist, so `tapestry` shows exactly what this instance offers you, today. Never assume an operation exists because you saw it somewhere else: list them.

## Install the CLI, once per machine

From a checkout of the tapestry repo:

```
cd clients/cli
npm ci --omit=dev
npm link
```

Before `npm link`, run `which -a tapestry`. If another program named `tapestry` is already on your PATH, such as an older Tapestry CLI, ask your person whether to remove it. Then check you have the right one:

```
tapestry --version
```

It must say "the external CLI for a Tapestry instance's operations (/api/tapestry/)". Inside an instance's container, `tapestry` is a different command, the internal one, which needs no sign-in.

## Your key

You sign in with your own nostr key. How you keep it is up to your setup. The CLI takes it in any of these ways, the first that is set:

| Way | When |
|---|---|
| `--key-file <path>` before the command, or `TAPESTRY_KEY_FILE=<path>` | a file holding your nsec, readable only by you (`chmod 600`); the CLI refuses a file others can read |
| `TAPESTRY_SECRET_KEY=<nsec or hex>` | your key arrives in your environment, from a secret store |
| `TAPESTRY_SIGNER=<command>` with `TAPESTRY_PUBKEY=<npub>` | a signer of your own signs for you, so the CLI never sees your key. It gets the unsigned sign-in event as one line of JSON on stdin, and must print the signed event on stdout: for example `nak event --sec bunker://…`, a NIP-46 remote signer |
| `tapestry key new` | you have no key yet: it makes one in `TAPESTRY_HOME/key`, readable only by you, and prints its npub and hex, never the secret. `tapestry key new --file <path>` puts it somewhere else |

`tapestry key show` says which key the CLI will use and its npub, never the secret.

The CLI keeps your sign-ins, and any key it made, in `TAPESTRY_HOME`, by default `~/.config/tapestry`. If several agents share one machine user, give each its own `TAPESTRY_HOME`, so their sign-ins stay apart.

## Get made an admin

Give your npub, from `tapestry key new` or `tapestry key show`, to the instance's owner, and ask them to make it an admin. The owner does that on the instance's administrators page, `/pages/manage/manage-administrators.html`. Only the owner can; you can't do it yourself.

## Choose the instance

Run `tapestry use <url>` once to set a default instance, like `https://tapestry.example.com`. Or give `--instance <url>` before the command, or set `TAPESTRY_INSTANCE`: the flag wins over the variable, and the variable over the default. The URL is an origin, with no path, and must be https, except for this machine (localhost, 127.0.0.1, [::1]).

## Start here, every time

1. `tapestry whoami` says who your key is on this instance: `owner`, `admin` or `neither`. If it says `neither` (exit 1), stop, and ask the owner to make your npub an admin. If it says `local`, you reached the instance's own port on its own machine, which it trusts without a sign-in and so can't tell who you are: use its public address instead, so your changes are known to be yours.
2. `tapestry lifecycle status` gives the instance's state: its last backup, its firmware, the migrations applied and its cache. Read it before you change anything.
3. `tapestry`, or `tapestry help`, lists every operation you may call here, by group, with a one-line summary of each.

`tapestry login` signs in afresh. You rarely need it: the CLI signs in by itself when it must, and keeps the sign-in for about 30 days. `tapestry logout` ends the sign-in on the instance and forgets it.

## Find and call an operation

- `tapestry <group>` lists one group's operations.
- `tapestry <group> <operation> --help` shows what it takes (each input, its type, whether it's required, its default), what it returns, its refusals, who may call it, and its route. Read it before your first call to any operation.
- `tapestry <group> <operation> --name value` calls it. Give inputs by their names: `--name=value` works too, a flag with no value is true, and a repeated flag makes a list (`--tag a --tag b`).

The instance checks every input, so you can't skip a rule from here, and you needn't guess at types: a wrong input comes back as a refusal that names it.

## Answers, refusals and exit codes

stdout carries only the instance's JSON answer: `{ "success": true, "data": … }`, or a refusal, `{ "success": false, "error", "code", "input" }`, where `input` names the input at fault, if one is. Everything else goes to stderr.

| Exit | Meaning | What to do |
|---|---|---|
| 0 | answered | use `data` |
| 1 | refused | read `code`, `error` and `input`, then fix the call, or stop and say why |
| 2 | usage | the command line is wrong, or something isn't set up: read stderr |
| 3 | failed | the instance failed, couldn't be reached, timed out (`TAPESTRY_TIMEOUT`, in seconds, 300 by default) or answered something that isn't its JSON: read stderr. A read may be tried once more. A write may have run before it failed, so read back what it would have changed before you try it again |

## Never

- Never ask for, accept or use the owner's key, or any key but your own, and never share yours: not in a message, a log, a file others can read, or a command line.
- Never reach for raw Cypher, or for the instance's older routes outside `/api/tapestry/`. If no operation does what you need, say so.
- Never repeat a refused write without reading why it was refused. A refusal is the instance telling you something.
