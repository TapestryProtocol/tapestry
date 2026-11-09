# Epic: graph-operations-foundation

**Created:** 2026-11-08
**Status:** Active

## Goal

Build the base every graph operation stands on, so the operations of the graph-operations design
([docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md), catalog
[docs/GRAPH_OPERATIONS_CATALOG.md](../../docs/GRAPH_OPERATIONS_CATALOG.md)) can be built one at a time, by whoever needs
each first. These are the first six tasks of Loom block A10: the operation declaration with its routes, command and
`/docs` entry (A10.1); backup and restore (A10.2); a tapestryKey on every node (A10.3); the write path (A10.4); the field
mapping (A10.5); and the external CLI with the agent's skill (A10.6).

This epic realizes the Foundation and Backup bullets of book
[engineering-team/audits/graph-operations-first-slice/book.md](../audits/graph-operations-first-slice/book.md).

## Why it matters

The owner wants agents to change a Tapestry's concept graph through operations that keep it valid, rather than through
raw Cypher or routes that sign a nostr event before they write (BIBLE §30: an unpublished write is a private thought).
Teammates will build different operations at the same time, so the base has to let each operation be added in files of
its own, with nothing shared to edit.

## Stories

1. `stories/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md` — each operation declared once,
   reached as a route under `/api/tapestry/`, a command inside the instance and a `/docs` entry, and listed for agents,
   proved with `lifecycle status` (Loom A10.1).
2. `stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md` — a full backup of the instance (its graph,
   its assistant's key and its admin list), restored on this instance or a fresh one, and moved between instances by
   download and upload (Loom A10.2).

6. `stories/graph-operations-foundation/6-external-cli-and-agent-skill.md` — the external CLI, which signs in with an
   admin agent's own key and calls every operation the instance lists, and the agent's skill (Loom A10.6).

Later stories follow the Loom tasks A10.3–A10.5, each planned when it is taken. The foundation's stories, and each story's first
ADR, are numbered by their Loom task (A10.n is story n and ADR 000n), because several are planned at the same time in
different sessions.

## Key facts / guardrails

- **One declaration per operation, in files of its own** — so parallel builders never edit the same file.
- **Routes live under `/api/tapestry/<group>/<operation>`** (D13); the command is `tapestry <group> <operation>`.
- **Callers:** the owner and admins (agents' nostr keys); admins equal the owner unless the owner decides otherwise for
  a route (ADR `security-auth-exposure/0005`, Decision 4). New reads stay behind sign-in until read visibility is
  decided (catalog §10, question 1).
- **Nothing here signs a nostr event** (D1).
- **Live checks run on a scratch stack** (`scripts/scratch-stack.sh`), never on a shared or private instance.
- **Loom tracks each story as its A10 task;** the story's pull request names the task id.
