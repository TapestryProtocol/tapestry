# Story 2: Back up and restore the whole instance — `lifecycle backup` and `restore`, and moving a backup between instances

**Status:** Approved
**Created:** 2026-11-08
**Type:** Feature
**Loom:** A10.2 — https://loom.brainstorm.world/t/A10.2

## Background

BIBLE §30 makes Neo4j the definitive self: "A Neo4j backup restores the self in full", and unpublished state is "mortal and box-bound", so durability has to be provided deliberately. Today nothing backs up the graph. `bin/backup.js` copies configuration, keys and logs, not Neo4j, and nodes that exist only in Neo4j, such as event-less sets, have no backup at all (OPEN.md row 281). The graph-operations catalog (§8) drafts `lifecycle backup` ("a Neo4j dump first; later encrypted and chunked into nostr events on a mirror relay") and `lifecycle restore` ("keeping its tapestryKeys and provenance"). The book's frame asks that the owner "can take a full Neo4j backup and restore it on a fresh instance, with every tapestryKey intact". Loom puts this task (A10.2) right after the operation declaration (A10.1, merged) and before A10.3, which changes every node, so that the graph can be backed up before it is migrated.

Three facts about today's instance shape the story:

- **A backup takes the graph offline for a few seconds.** The instance runs Neo4j 5.26 Community, which has no online backup. Vinney's brain README describes a backup he verified by restoring it: a database dump taken with Neo4j stopped for a few seconds, plus the volume that holds the instance's key (Loom memo #75 on A9.4).
- **A fresh instance is a different instance.** Each instance makes its own assistant key at first boot, and that key is the instance's own name (BIBLE §31). A graph restored on a fresh instance would name the old instance's assistant as the author of its own nodes (firmware, concept headers), so the fresh instance wouldn't treat them as its own. The owner chose to carry the assistant's key in the backup, so that a restore makes the fresh instance the same instance.
- **The owner is set when the instance is launched.** The instance's launch settings name the owner and are applied at every start, so a restore can't change who the owner is. The admins are kept in the instance's own settings, and can be restored.

At the planning gate (2026-11-08) the owner widened the task. Admins may do everything the owner may: "Owner and Admins can do both." A backup can be moved between instances through the API: "Add owner + admin routes to download and upload a backup." He then chose to let admins download the assistant's secret key and restore the key and the admin list. For these operations, that replaces his two owner-only rules of 2026-10-10: signing as the instance's assistant, and changing the admin list (ADR `security-auth-exposure/0005`, the owner's gate decisions, item 3).

## User-facing description

As the owner of a Tapestry instance, or an admin agent working for them, I want to take a full backup of the instance in one call — its whole graph, its assistant's key and its admin list — so that nothing in the graph is mortal, including what was never published.

As the owner or an admin, I want to restore a backup, on this instance or on a fresh one, and get the instance back exactly: every node and relationship as it was, every tapestryKey intact, and the same assistant, so that the restored instance is the same instance.

As the owner or an admin with no shell on the server, I want to download a backup as one file and upload it to another instance, so that I can move an instance or keep a copy off the box.

A downloaded backup holds the instance's secret key: anyone with the file can sign as the instance. It has to be kept like a key.

## Acceptance criteria

- [ ] **AC1 — Take a backup.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/lifecycle/backup`, optionally with a short `note` such as "before migrate", then the instance saves a backup of its whole graph, its assistant's key and its admin list, on storage that outlives the container being recreated. It answers with:
  - the backup's id, when it was taken, its size and its note;
  - what it holds: how many nodes, relationships and nodes with a tapestryKey; the assistant's pubkey; the owner's pubkey at the time; the admins;
  - how long the graph was offline.

  The graph is offline only while the backup is taken. Requests that need the graph fail during that time, and the instance recovers by itself, with no step by hand. When some of the graph's content is held only in the cache store, as json tags offloaded to the LMDB, which a backup doesn't carry, the answer says how many. *(Staging and production have none today.)*
- [ ] **AC2 — See the backups.** Given an instance that holds backups, when the owner or an admin asks for `lifecycle status`, then its backup part shows the most recent backup: its id, when it was taken, its note and its size. When they call `GET /api/tapestry/lifecycle/list-backups`, then they get every backup the instance holds, newest first, each with what AC1's answer gives and whether it was taken here or uploaded. With no backup, status says none has been taken, and the list is empty.
- [ ] **AC3 — Restore, and prove it.** Given a backup the instance holds, when the owner or an admin calls `POST /api/tapestry/lifecycle/restore` with its id, then:
  - the instance first takes a backup of its current graph, assistant's key and admin list, the **safety backup**, and names it in the answer, so nothing is lost;
  - it puts the backup in place: every node with exactly its labels and properties (its tapestryKey, and whatever records where it came from, such as its `NostrEvent` label and its event's fields), every relationship with its type, direction and properties, the assistant's key and the admin list;
  - the answer compares what came back with what the backup recorded when it was taken: the numbers of nodes, relationships and tapestryKeys, and whether the tapestryKeys are exactly the same set. If they don't match, it says so and names the safety backup to go back to;
  - the answer names the assistant before and after. When the backup's owner differs from this instance's owner, it says so; the owner stays as the instance's launch settings name it.

  Within a minute of the answer, with no step by hand, the instance answers as the restored instance: `GET /api/assistant/pubkey` gives the backup's assistant, and the admins are the backup's.
- [ ] **AC4 — Move a backup to a fresh instance.** Given a backup on one instance, when the owner or an admin downloads it with `lifecycle download-backup`, as one file, uploads that file to a freshly launched instance with `lifecycle upload-backup`, and restores it there, then the fresh instance becomes the same instance, as AC3 describes: the same graph, node for node and relationship for relationship, with every tapestryKey intact, the same assistant and the same admins. An uploaded file is checked before it is kept: one that isn't a whole, undamaged backup is refused, and one that is appears in the list as uploaded.
- [ ] **AC5 — Refusals.** Restore refuses, and changes nothing, given a backup id the instance doesn't hold (naming the ones it does), a backup that is damaged or incomplete, or a backup taken with a newer version of the graph database than this instance runs. Backup, restore and upload each refuse while another backup or restore is running. Each refusal says in words what went wrong.
- [ ] **AC6 — Who may call, and the commands.** Every operation in this story is open to the owner and admins alike (the owner's ruling, 2026-11-08). A caller who isn't signed in is refused with 401, and a signed-in person who is neither the owner nor an admin with 403. Someone with a shell inside the instance runs `tapestry lifecycle backup`, `tapestry lifecycle restore --backup <id>` and the other commands without signing in, and gets the same answers as the routes.

Six criteria, covering five operations. They stay one story because only the whole path — back up, move, restore on a fresh instance — shows that a backup is whole, which is the task's done-when, and because the five share one store of backups. Download and upload could become a story of their own if the change would be too big to review in one sitting.

## Concepts touched

None changed. Backup and restore act on the whole graph, every concept included, without reading or writing any concept's elements one by one.

## Out of scope

- Encrypting a backup, and stashing it as nostr events on a mirror relay: BIBLE §30's pipeline, which the catalog leaves for later. The catalog's `target?` input waits for that second target; for now a backup is kept on the instance's own storage.
- The relay's events (strfry) and the cache store (LMDB). The graph is whole without them (§30). A restored instance's relay won't hold the old instance's events until they are fetched again, and the cache is rebuilt from the graph (`cache rebuild`, catalog §7). A restore doesn't rebuild the cache.
- Changing the owner. The instance's launch settings name the owner, and restore reports a different owner without changing it.
- The instance's other settings and files: the rest of its settings, its session secret, the relay router's configuration, customers' keys and its logs (what `bin/backup.js` copies).
- Deleting backups, or keeping only the latest few. Backups build up on the instance's storage, and the list shows each one's size.
- Restoring part of a graph, such as one concept. A restore is the whole graph.
- Backups on a schedule, and any UI.
- `lifecycle wipe` (A10.38), which will need a backup first.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

All four were resolved at the planning gate on 2026-11-08.

1. **Who may call?** *Resolved: the owner and admins, for every operation:* "Owner and Admins can do both."
2. **A backup taken on another instance?** *Resolved: the owner chose the option "Carry the key too".* A backup holds the assistant's key and the admin list, so a restore makes the instance the same one. The owner can't be carried (Background).
3. **Moving a backup between instances?** *Resolved: download and upload routes:* "Add owner + admin routes to download and upload a backup."
4. **The assistant's secret key and the admin list?** *Resolved: the owner chose the option "Admins get it all".* Admins may download the key, and restore the key and the admin list. For these operations, that replaces the two owner-only rules of 2026-10-10 (ADR `security-auth-exposure/0005`, item 3 of the owner's gate decisions). The ADR records it.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Backup bullet)
- Epic: [engineering-team/epics/graph-operations-foundation.md](../../epics/graph-operations-foundation.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D6, D10, D13); catalog §8
- Story 1, whose `lifecycle status` this fills in: [1-operation-declaration-and-lifecycle-status.md](1-operation-declaration-and-lifecycle-status.md)
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
