# Story 1: Declare each operation once — the `/api/tapestry/` routes, their sign-in, and `lifecycle status`

**Status:** Approved
**Created:** 2026-11-08
**Type:** Feature
**Loom:** A10.1 — https://loom.brainstorm.world/t/A10.1

## Background

The graph-operations design ([docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md), decisions D1–D13) and its catalog ([docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md)) describe 58 operations in seven groups that read and change an instance's own Neo4j graph without signing a nostr event. Each operation is reached three ways: a route at `/api/tapestry/<group>/<operation>` (D13), a command `tapestry <group> <operation>` for someone with a shell inside the instance, and an entry in the instance's API document at `/docs`. The owner's direction (2026-11-07) is to "build and use these tools, one operation at a time", and on Loom (block A10) each operation is a task that whoever needs it first takes and builds. Several people will therefore be adding operations at the same time.

This story is the base they all build on, proved with the first real operation. Two things about today's instance shape it:

- **Every route is listed by hand twice.** The route table says who may call each route, and a route with no entry is the owner's side's (ADR `security-auth-exposure/0005`). The `/docs` coverage gate fails on a route that is neither in the API document nor in its known-gaps list. If adding an operation meant editing those shared lists, every teammate's change would touch the same files.
- **Who calls these operations.** The owner, a person, and admins, who are agents' nostr keys (design §2). Both already sign in with the instance's signed-challenge sign-in. Admins equal the owner unless the owner decides otherwise for a route (ADR `security-auth-exposure/0005`, Decision 4). Someone with a shell inside the container needs no sign-in, the same trust today's in-container calls get (design §2).

The first operation is `lifecycle status` (catalog §8): the last backup, the firmware version, the migrations applied, and how fresh the cache is. Backup, migrate and the cache checks are later tasks (A10.2, A10.3 and the cache group), so today it reports what it can and says plainly what isn't recorded yet. The book's frame keeps every new read behind an owner or admin sign-in until read visibility is decided (catalog §10, question 1).

## User-facing description

As the owner of a Tapestry instance, or an admin agent working for them, I want every graph operation declared once and reachable the same way — as a route under `/api/tapestry/`, as a command inside the instance, and as an entry in `/docs` — so that I can find and call any operation that has been built, and a teammate can add an operation without touching anyone else's files.

As the owner, or an admin agent, I want `lifecycle status` to tell me in one call whether the graph has been backed up, which firmware it carries, which migrations have run, and how much of its cache is built.

As an admin agent, I want to ask the instance which operations I may call, and what each takes and returns, so that a client can call a new operation the day it lands without being changed.

## Acceptance criteria

- [ ] **AC1 — Status for the owner and admins.** Given the owner or an admin is signed in, when they request `GET /api/tapestry/lifecycle/status`, then the answer has four parts, each saying plainly what it knows:
  - **backup:** no backup recorded yet;
  - **firmware:** the firmware version this instance carries, and whether it is installed in the graph (all, some or none of its concepts present, with how many);
  - **migrations:** none recorded yet;
  - **cache:** how many nodes have a cached Tapestry JSON, and how many don't.

  It changes nothing: asking twice, with the graph unchanged, gives the same answer.
- [ ] **AC2 — Who may call.** Given any operation under `/api/tapestry/`: a caller who isn't signed in is refused with 401, and a signed-in person who is neither the owner nor an admin with 403, each with a message naming who may call it; a direct-local caller inside the container is let through, as today. Given a declaration that tries to open an operation to visitors, or to signed-in people who aren't the owner or an admin, then those callers are still refused, and the instance reports the declaration as invalid. An admin may call `lifecycle status` (open question 1).
- [ ] **AC3 — The command inside the instance.** Given a shell inside the instance's container, when someone runs `tapestry lifecycle status`, then it prints the same status the route returns, without signing in. `tapestry` on its own lists every declared operation by group, with a one-line description of each; an unknown group or operation is refused with a message listing what exists.
- [ ] **AC4 — The `/docs` entry.** Given the instance is running, when someone opens `/docs`, then `GET /api/tapestry/lifecycle/status` appears under its group, with its description, who may call it, its inputs (none), its result and its refusals, all taken from its declaration, so a change to the declaration changes the entry. The `/docs` coverage gate passes with no known-gaps entry for it.
- [ ] **AC5 — Inputs checked from the declaration.** Given an operation that declares its inputs, when a caller sends an input it doesn't declare, leaves out a required one, or sends one of the wrong type, then the route refuses with 400 naming the input, and the command refuses the same call the same way, before the operation runs. The command takes the declared inputs by name. *(Shown with a declaration made for the test, since `lifecycle status` takes no inputs.)*
- [ ] **AC6 — One operation, its own files.** Given a new operation declared in files of its own, and no other file in the repo changed, when the instance starts, then its route answers at `/api/tapestry/<group>/<operation>` with the access its declaration names, `tapestry <group> <operation>` runs it, and `/docs` lists it, with the route-table checks and the `/docs` coverage gate still passing. A test shows this.
- [ ] **AC7 — The list of operations.** Given the owner or an admin is signed in, when they ask the instance for its operations, then they get every declared operation they may call, each with its group, name, route, inputs, result and refusals — the facts `/docs` shows — in a form a program can read. A caller who isn't signed in, or isn't the owner or an admin, is refused as in AC2. In AC6's test, the new operation appears in the list too.

Seven criteria, past the usual five. They aren't split, because AC2–AC7 are the declaration's four products and its two guarantees, and without AC1's real operation there is nothing to prove them on (Loom's done-when for A10.1 asks for both).

## Concepts touched

None changed. `lifecycle status` reads, without writing:

- the firmware concepts of the instance's active firmware — whether each is present in the graph (the Architect resolves handles from the active manifest);
- the cached Tapestry JSON (the LMDB cache, D10) — how many nodes have one.

## Out of scope

- Every other operation: the graph, raw, rules, import, export and cache groups (A10.7 onward), and the other lifecycle operations — backup and restore (A10.2), migrate (A10.3), seed-firmware and wipe. Until those land, `lifecycle status` says their parts aren't recorded yet.
- The write path: guards, change entries and the no-signing rule for writes (A10.4). This story's one operation only reads.
- The external CLI and the agent's skill (A10.6), including which external CLI to use (design §5, question 6), which A10.6's planning settles with Avi and Vinney.
- Deciding read visibility (catalog §10, question 1), or whether admins differ from the owner in general (§10, question 3), beyond open question 1 below.
- Telling whether a cached JSON is stale, older than its node's last change. That is `cache check` (catalog §7); status only counts what is cached.
- Changing or retiring any existing route: `/api/firmware/install-status`, `/api/tapestry-key/derive-status` and the rest keep working as they do.
- Any UI.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Both were resolved at the planning gate on 2026-11-08, where the owner chose the Product Owner's recommendation each time.

1. **Who may call `lifecycle status`?** *Resolved: the owner and admins.* The catalog drafts the whole lifecycle group as owner only (§8), but by default admins equal the owner (ADR `security-auth-exposure/0005`, Decision 4). It's a read with nothing secret in it, and an admin agent should be able to check the backup, firmware and cache before it writes. Lifecycle's writes (backup, restore, migrate, seed-firmware, wipe) are their own tasks and keep the catalog's owner-only draft for their own planning.
2. **Should agents also get a machine-readable list of the operations they may call?** *Resolved: yes, in this story, as AC7.* A10.6 wants an external CLI that reads the declared operations from the instance and needs no change when an operation is added. The list comes from the same declarations, so A10.6 doesn't have to change the shared base.

## Deviations

Small judgment calls made in Implementation, inside the ADR:

- Input names may be camelCase (letters and digits, starting with a letter), while group and operation names are kebab-case. The catalog's inputs include `dryRun`, and the command takes an input by its own name (`--dryRun`).
- `failed` is reserved along with the built-in refusal codes: it is the code of a 500, so no declaration may name it as a refusal.
- A load problem's `file` is relative to the catalog (`graph/visible.js`), so the list never carries an absolute path.
- The list route's `/docs` entry has its own tag, `Tapestry operations`, beside one tag per group.
- The command prints load problems on stderr only when it lists operations, not on every run.
- Moving `GET /api/tapestry-key/status`'s counting into `readTapestryKeyCounts()` re-indented the moved block to the file's two spaces. The whitespace inside its two Cypher strings changed with it, and the queries, the counts and the response did not.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Foundation bullet, and "Reads stay behind sign-in")
- Epic: [engineering-team/epics/graph-operations-foundation.md](../../epics/graph-operations-foundation.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D13, §2); catalog Conventions and §8
- ADR: [engineering-team/decisions/graph-operations-foundation/0001-declare-each-operation-once.md](../../decisions/graph-operations-foundation/0001-declare-each-operation-once.md)
- Test plan: [1-operation-declaration-and-lifecycle-status.test-plan.md](1-operation-declaration-and-lifecycle-status.test-plan.md)
- Review: (filled in after Review phase)
