# Story 4: The write path — writes that check the graph's rules, record who changed what, and never sign, proved with `graph add-relationship`, `remove-relationship` and `history`

**Status:** Approved
**Created:** 2026-11-14
**Type:** Feature
**Loom:** A10.4 — https://loom.brainstorm.world/t/A10.4, taking in A10.29 (add-relationship and remove-relationship) and A10.15 (history), as the owner chose at the planning gate (2026-11-14)

## Background

The book's frame asks of the foundation: "Writes run their guards, record which admin made each change, and never sign." Loom's A10.4 says how: "Each rule is defined once and runs both as a guard before a write and as a check over the graph (D3). A write refuses what breaks a guard, is safe to repeat, never signs a nostr event (D1), and records a change entry: which admin, which operation, what changed." It is done "when one guarded write runs through it end to end: it refuses a write that breaks a guard, records its change entry, signs nothing, and the entry can be read back." Every graph write after this one goes through the path this story builds.

At the planning gate (2026-11-14) the owner chose how the story proves it:

- **The write that proves it** is `graph add-relationship`, with its pair `remove-relationship` (Loom A10.29): the smallest real write that has a guard, and one the rebuild needs at once, since Avi's brain has about 8,000 typed links (the book).
- **The entry is read back** through `graph history` (Loom A10.15), in its simplest form: changes to a node, by one admin, or since a time. A10.15 only reads what this path records.
- **The import path waits.** D4's recording path for imports, which skips the guards and records where each node came from, is built with the first importer that needs it (A10.32 or A10.33).

Seven facts about today's instance shape the story:

- **Nothing records who changed what.** The signing routes sign as the instance's assistant whoever asked, and the Neo4j-only routes record nothing. Lifecycle migrate's runs, which say who ran them, are the only exception. The design lists "no provenance marking" among today's gaps (§4), and leaves open how a change records which admin made it (§5, question 2).
- **Rules are checked here and there.** Today's guards live inside individual routes: create-concept's duplicate check, add-subset's refusals, the relationship whitelist (design §7). D3 asks for each rule to be defined once and used two ways, as a guard before a write and in `rules check`.
- **Today's add-relationship allows two types.** `POST /api/normalize/add-relationship` writes to Neo4j only, names its nodes by `uuid`, and takes the two class-thread types, `HAS_ELEMENT` and `IS_A_SUPERSET_OF`. The catalog sends those edges to operations of their own, with the guards they need: `link-set` refuses a cycle, `add-to-concept` checks the element against its concept's schema, and `remove-from-concept` refuses a node's last concept (catalog §2 and §9).
- **The graph declares its relationship types.** Each is an element of the relationship type concept, and names its Neo4j type, a category, and the kinds of node it runs from and to. Firmware 1.0.0 makes 14 of them, and every one is made by another operation or by the nostr import: the class threads (3), a concept's core-node wiring (6), the property tree (2), and the import's `AUTHORS`, `HAS_TAG` and `REFERENCES` (3). Avi proposed, on Loom A10.29, that add-relationship take only declared types and refuse reserved names, since `REFERENCES` already collides (BIBLE §22's collision contract).
- **Nodes have keys now.** A10.3 gave every node a unique tapestryKey under the shared label, so a write can name its nodes by key (catalog, Conventions).
- **Writes take bodies that aren't JSON.** Loom memo #96, from A10.1's review: "refuse a write whose Content-Type isn't `application/json`." The control panel parses form-encoded bodies as well as JSON, and its session cookie sets no SameSite, so a cross-site form post is otherwise left to the browser's defaults. The same memo notes that the command and the route word a failure differently when an operation throws something that isn't an error.
- **Agents already have a way in.** The external CLI (A10.6) reads the instance's list of operations and turns each into a command, so a new operation reaches agents without a change to it.

## User-facing description

As an admin agent rebuilding a concept graph, or the owner, I want to add and remove typed relationships between nodes, named by their tapestryKeys, without signing anything, so that I can wire the graph privately and simply repeat a step if a call fails partway.

As the owner, I want every change made through the new operations to record who made it, through which operation, when, and what changed, and to read those records back by node, by who made them, or since a time, so that I can see what my agents have done.

As the owner, I want a write that would break one of the graph's rules to be refused before anything changes, with the problem named, so that the graph stays valid whoever writes to it.

## Acceptance criteria

- [ ] **AC1 — Add a relationship.** Given the owner or an admin is signed in, two nodes named by their tapestryKeys, and a relationship type that the graph declares and that no other operation or the nostr import makes, when they call `POST /api/tapestry/graph/add-relationship` with `from`, `to` and `type`, then the graph holds exactly one relationship of that type from the first node to the second. The answer gives the relationship and its change entry (AC4), and nothing is signed (AC6). Called again with the same three, it adds no second relationship, records no second entry, and answers that the relationship was already there.
- [ ] **AC2 — The guard refuses before anything changes.** add-relationship refuses each of these, changes nothing, records no entry, and says in words what was wrong:
  - a type the graph doesn't declare, naming it;
  - a type the graph declares but reserves for another operation or for the nostr import — today, every type firmware makes — naming the operation that makes it, where there is one;
  - a `from` or `to` that names no node, naming which.

  The rule behind the first two is defined once. Run as a check over a set of relationships, the same definition names each one that breaks it (D3), so that `rules check` (A10.31) can run it over the graph later. It is written into the rules document (design §7) with what it says, that it refuses a write, and how a check finds what breaks it.
- [ ] **AC3 — Remove a relationship.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/remove-relationship` with the `from`, `to` and `type` of a relationship that exists, then it is gone, and the answer says so, with its change entry. Nothing is signed. Called again, it changes nothing, records nothing, and answers that the relationship was already gone. Its type is held to AC2's rule, so it can't remove a class-thread edge, a concept's core-node wiring or anything the import made. A `from` or `to` that names no node is refused as in AC2.
- [ ] **AC4 — Each change is recorded with it.** Given a write that changes the graph, then it records one change entry, kept together with the change: both are kept, or neither is, so a failure between them leaves the graph as it was and no entry. The entry says:
  - who made it: the owner or an admin, by pubkey, or the internal command (someone with a shell inside the instance);
  - which operation, such as `graph add-relationship`;
  - when;
  - what changed: each relationship added or removed, by its type and the tapestryKeys of its two nodes.

  A refused write records no entry, and neither does a repeat that changes nothing.
- [ ] **AC5 — Read it back: `graph history`.** Given the owner or an admin is signed in, when they call `GET /api/tapestry/graph/history`, then they get the change entries, newest first, up to a capped number at a time, with a cursor for the next page. They can filter by a node (the entries that touched it), by who made them, and by a time (the entries made since). The filters combine. The entries survive a restart of the instance. A backup carries them, so restoring it brings back the history as it was when the backup was taken, in step with the graph it restores.
- [ ] **AC6 — JSON only, and nothing signed.**
  - Every write in the operations module, lifecycle's included, refuses a body that isn't sent as JSON (415) and changes nothing, except an operation whose declared body is a file (lifecycle upload-backup).
  - No write through the path signs anything or sends anything to a relay, whether it is accepted, refused or repeated: the instance's relay holds no new event afterwards.
- [ ] **AC7 — Callers, the command, and an agent.** The three operations are for the owner and admins. A caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. Each is listed for agents and has its `/docs` entry, made from its declaration. Someone with a shell inside the instance runs `tapestry graph add-relationship --from <key> --to <key> --type <type>`, and likewise the other two, without signing in, gets the same answers as the route, and their entries name the command as who made them. When an operation fails by throwing something that isn't an error, the command and the route give the same words. An admin agent with its own key adds a relationship, removes it, and reads both entries back through the external CLI (A10.6), with no change to the CLI.

Seven criteria, covering the path and three operations. They stay one story because the path needs a write to prove it and a read to show what it recorded, and the owner chose these to be them. If the change proves too big to review in one sitting, history (AC5) can become a story of its own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- `39998:<TA>:relationship-type` — relationship type (read only). Its elements are the types the graph declares, which AC2's rule reads. Nothing in this story changes it.
- `39998:<TA>:relationship` — relationship (not touched). add-relationship makes an edge in the graph, not an element of this concept. How an edge is sent as a letter is export's question (A10.34).

## Out of scope

- **The import path** (D4): built with the first importer, A10.32 or A10.33 (the owner's answer, 2026-11-14). This story's change entry leaves room for where a node came from.
- **Declaring a new relationship type** through the new operations, which is `graph create-element` (A10.20). Until it lands, a type is declared through today's routes (D15). On a fresh instance every declared type is reserved (AC2), so a type is declared before the first relationship of it is added.
- **A relationship's ends.** A declared type names the kinds of node it runs from and to. Checking a relationship's ends against them is a rule for later.
- **Properties on a relationship,** such as an order (catalog §10, question 7), and **bulk writes** (question 6): one relationship per call, with no properties.
- **The edges other operations make:** class threads, core-node wiring and the property tree belong to `link-set`, `add-to-concept`, `remove-from-concept`, `create-concept`, `add-property` and `enumerate`, each with its own guards.
- **`rules list-rules`, `check` and `repair` as operations** (A10.31). This story defines its rule so that check can use it.
- **Lifecycle's writes in history.** Backup, restore, migrate and upload keep their own run records.
- **Today's routes,** `POST /api/normalize/add-relationship` and `delete-relationship`, which stay as they are (D15) and record nothing.
- **Publishing a relationship** as a nostr event (A10.34).
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

To resolve at this gate.

1. **Which write proves the path?** *Resolved: add-relationship and remove-relationship, taking in Loom A10.29* (the owner's answer, 2026-11-14). AC1–AC3.
2. **How is the entry read back?** *Resolved: `graph history`, in its simplest form, taking in Loom A10.15* (the owner's answer, 2026-11-14). AC5.
3. **Does this story build the import path?** *Resolved: no, the first importer does* (the owner's answer, 2026-11-14). Out of scope.
4. **Which types may add-relationship add?** *Resolved: the ones the graph declares, except those reserved for other operations and the nostr import, which today is every type firmware makes* (the owner's answer, 2026-11-14). An admin declares a type before adding relationships of it. AC2.
5. **Are the change entries kept with the graph?** *Resolved: yes,* so a backup carries them and a restore keeps history in step with the graph (the owner's answer, 2026-11-14). AC5.

For Architecture, not this gate:

- **Where the change entries live,** and how a write and its entry are kept together (design §5, question 2; BIBLE §30's "provenance representation"). If they are nodes, the rules every node meets apply to them: a tapestryKey, the shared label, and D9's "element of at least one concept".
- **Whose declarations count.** A relationship type declared by someone else, brought in by an import, is a claim; whether it counts for the owner's own writes is a point-of-view question (D4, CLAUDE.md principle 1).
- **How reserved types are told apart:** by the category each declares, by a list, or otherwise.
- **The declaration's new fields** memo #96 places in the declaration's rules: the guards, the key that makes a write safe to repeat, and the change entry.
- **How `by` names who made a change** (a hex pubkey, an npub), and history's cap and cursor.
- **A firmware install and relationships it doesn't make.** Today's install can prune relationships the normalize primitives added (`src/api/normalize/relationships.js`'s hazard note). Check whether it can remove one of a type firmware doesn't declare.

## Evidence

### The live check (Implementation, 2026-11-14, on `e84018c9`)

This ran on a throwaway instance from `scripts/scratch-stack.sh`, never a shared or private one. Every step and number is in the test plan's Verification. By criterion:

- **AC1: passes.**
  - An add answers `added` with its entry, and a repeat `already-there` with none.
  - Two adds at once make one relationship and one entry.
- **AC2: passes.**
  - Reserved types (`HAS_ELEMENT` on a real class-thread edge, `FOLLOWS`) are refused 409 `reserved-type`, and the edge stays.
  - An undeclared type is refused 409 `undeclared-type`.
  - A change entry named as a node is refused 404 `unknown-node`.
- **AC3: passes.** A removal is recorded with its count, and a repeat answers `already-gone`.
- **AC4: passes.** A write whose entry couldn't be written kept neither the change nor an entry, on Neo4j's own transaction.
- **AC5: passes.**
  - History answers newest first, through the `graph_change_at` index. At 100,000 entries a page takes about 5 ms, and a node in 10 of them 48 ms, since it reads every entry (ADR debt 2).
  - Both indexes are made at start.
  - A restore brings back exactly the history of the graph it restores.
- **AC6: passes.** A text/plain body is refused 415. The relay held 450 events before the first graph write and after the last.
- **AC7: passes.** An admin agent with its own key, through the external CLI and the instance's nginx, added, removed and read back both entries, recorded as its own.
- **Also,** a firmware reinstall leaves a relationship of a declared type, and its declaration, alone (Open questions, for Architecture).

## Deviations

- **The rule "every graph write applies" moved from the loader to a gate test** over the shipped catalog (ADR 0004 Amendment 2, the owner's ruling at Implementation, 2026-11-14). Story 1's and story 6's fixture catalogs keep generic `graph` writes with `run`. W1 changed to match, in a Tester commit of its own.
- **The entry's CREATE carries `keyNode('c')`** in place of writing `tapestryKey: randomUUID()` and the label itself. The outcome is the same: the shared label and a random v4 key. ADR 0003 Decision 8 holds every Cypher that makes a node to that one fragment, and story 3's guard G4 checks it. The fake graph learned to read it, in a Tester commit with its own test (F4b).
- **History's `LIMIT` is written into the query**, as a whole number the inputs' schema has already checked. The Neo4j driver sends a numeric parameter as a float, which `LIMIT` refuses.
- **The guard reads the concept's header once on its own** before reading its elements, so that with no concept in the graph its refusal says so (R6).
- **`since` is held to a real calendar time** (months 01–12, days to 31, hours to 23) by its pattern. A time `new Date()` can't read would otherwise fail with a 500.
- **The JSON-only refusal tells the caller what to send:** `Content-Type: application/json`, and `{}` when the write takes no inputs.
- **AR9 reads the central check's own 401 and 403,** as story 1's H5 does. On a POST, the central check answers first, with no code (ADR 0001 Decision 3), and AC7 names only the statuses. This was a Tester commit of its own.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Foundation bullet)
- Epic: [engineering-team/epics/graph-operations-foundation.md](../../epics/graph-operations-foundation.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D3, D4, D6, D15, §5 question 2, §7); catalog §1 (`history`) and §2 (`add-relationship`, `remove-relationship`)
- Story 1, the declaration this extends: [1-operation-declaration-and-lifecycle-status.md](1-operation-declaration-and-lifecycle-status.md)
- Story 2, whose backup carries the entries: [2-lifecycle-backup-and-restore.md](2-lifecycle-backup-and-restore.md)
- Story 3, whose keys name the nodes: [3-a-tapestry-key-on-every-node.md](3-a-tapestry-key-on-every-node.md)
- Story 6, the external CLI the agent uses: [6-external-cli-and-agent-skill.md](6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md](../../decisions/graph-operations-foundation/0004-the-write-path.md)
- Test plan: [4-the-write-path.test-plan.md](4-the-write-path.test-plan.md)
- Review: (filled in after Review phase)
