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

## Deviations

Small judgment calls made in Implementation, inside the ADR:

- **A test fix, kicked back to the Tester** (its own commit, `fb9c65cf1`). The 401 and 403 come from the central check, which answers before the module and carries no `code`. F2, B15, R16, D6 and U9 now assert as A10.1's H5 does: the status, `success: false`, and an error naming who may call.
- **The two file-body codes are reserved only where they apply.** `wrong-content-type` and `too-large` are built in only for a declaration with a file body. A read may declare its own `too-large`, as `download-backup` does for an 8 GiB dump. Every other built-in code is reserved everywhere, as before.
- **A thrown built-in refusal keeps its status.** `callOperation` answers a refusal a run throws at its status when the code is among the operation's refusals, built-ins included. The body's stream ends with `too-large`, which reaches the run.
- **Two helper files the ADR didn't name.**
  - `src/operations/files.js` holds the module's file helpers: the size counter, writing a stream to the command's stdout, and safe attachment names.
  - `src/operations/catalog/lifecycle/_common.js` holds what the five declarations share: result schemas, the opening checks, and restore's verification of a backup.
- **`bin/tapestry.js` is unchanged.** `cli.main`'s default `io` now includes `process.stdin`, so the bin needs no edit.
- **The command says the job finishes on its own for `restore` too,** not only for `backup`.
- **An upload's folder is `.incoming-<random>`, not `.incoming-<runId>`.** An upload takes no lock, so it has no run id.
- **The Neo4j version comes from `neo4j-admin --version`,** for the manifest and for restore's check alike. Decision 4 also named `CALL dbms.components()` for the manifest.
- **Stale-lock recovery does more than Decision 7 lists.** It also restarts the writers the dead run paused (the lock records them as `paused`), and it removes a dead restore's incomplete safety folder (the lock records it as `safety`).
- **Restore always warns about the cache:** each node's Tapestry JSON in the LMDB may be out of step until it is rebuilt.
- **The upload limit is 8 GiB plus 64 MiB:** room for a dump just under the 8 GiB a tar member holds, and still under nginx's 9g.
- **OPEN.md row 281** (event-less sets have no backup) is DONE.
- **Found by the live check: an instance with no admins recorded `[""]`.** The conf reader returns `BRAINSTORM_ADMIN_PUBKEYS=""` as the two characters `""` (OPEN.md row `2026-11-08-admin-list-empty-quotes`, left for its own story). A restore would have written that into another instance's settings, overriding its own admins. Backup and restore now keep only real 64-hex pubkeys. The Tester's failing test B19 came first, in its own commit (`2289da6f1`).
- **The report's `restarting` names `tagging-edges-realtime` only when it was running and so came back with the new key.** The live check's old scratch image has no such program.
- **Two robustness fixes from self-review.** The detached `supervisorctl restart` has an error handler, so a missing `supervisorctl` can't crash the process. And `dumpTo` closes its file even when `neo4j-admin` fails to start.

## Evidence

### The suites (Implementation, 2026-11-08)

The full `npm test` was not run on this Mac, because its live suites reach a private instance here; CI runs the gate on the pull request. Instead, the touched suites ran one by one through their `run()` exports on Node 24.18.0. Every service endpoint was dead and a `docker` that refuses every call was first on PATH, both set inside the runner.

- **`test/operations.test.js`, 121/0 on `b25f6588f`.** That is 46 tests of the module itself (A10.1's 39 plus F1–F7) and the 75 of the suites it finds under `test/operations/`:
  - backup 19/0, restore 17/0, list-backups 6/0, download-backup 7/0, upload-backup 10/0;
  - the job, the system and the configuration 8/0;
  - status 8/0.
- **Also passing on `b25f6588f`:** `admin-action-sweep` 9/0, `openapi-coverage` 13/0, `openapi-document` 10/0, `stack-free-npm-test` 6/0 (1 skipped).
- **21 more on `8fcb3d675`,** which the later commits don't reach: they changed only the lifecycle helpers, a test and docs. 498 passed and 3 failed.
  - The 3 failures are `router-stream-limit-on-connect` P1–P3, whose patch script needs GNU sed where this Mac has BSD sed. A10.1's evidence has the same three.
  - `admin-action-sweep-access`, `default-deny-mutations` and `brains-launcher-repo` were screened, read and run: their matches are route names and strings in test data.
  - The suites whose screen matched a container, a publish or a live URL were left out, `entrypoint-template-rendering` among them.

### The live check (Implementation, 2026-11-08)

The check used two throwaway instances in turn (`scripts/scratch-stack.sh`). Each ran image `tapestry-tapestry` with this branch's `src/` mounted at `b25f6588f` and `bin/tapestry.js` copied in, had no published ports, and was removed afterwards. All calls went over the container's own loopback. With 5.6 GB free, nothing had to be paused.

- **Instance A** had firmware installed, a fixture and an admin added to its settings. The fixture was two `LiveCheck` nodes with tapestryKeys and a date, a float and a list of integers, joined by a `LIVE_LINK` relationship with properties.
  - `tapestry lifecycle backup --note "live check"` exited 0: 3,147 nodes, 3,610 relationships, 2,535 tapestryKeys, counts exact, transaction 6944, the graph offline 18.1 s and answering at once after.
  - A second backup by the route answered the same way.
- **The download** gave the same 1.7 MB file by the command and by the route (one sha256).
  - Its headers: `Content-Type: application/x-tar`, `Content-Length`, `Content-Disposition: attachment; filename="tapestry-backup-<id>.tar"`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
  - bsdtar lists its five members, each mode 0600.
- **Instance B** was fresh, with its own assistant (`f2778d4d…`, where A's is `8e1c5911…`).
  - Uploaded by the route, the file was kept as `uploaded`, `sameInstance: false`. The same file again, by the command, was `alreadyHeld`.
- **The restore,** by the route:
  - the transaction it recorded was the one loaded (6944, 6944), and the counts and key digest matched;
  - the safety backup of B's own graph was taken first and is listed as `before-restore`;
  - the graph was offline 20.8 s;
  - the admins went from `[]` to A's admin, and `restarting` was `["brainstorm"]`, since the old image has no `tagging-edges-realtime`.
- **About 4 s after the answer,** `GET /api/assistant/pubkey` on B gave A's assistant. The conf's `BRAINSTORM_RELAY_PUBKEY` and `BRAINSTORM_RELAY_NPUB` lines name it, and `settings.json` holds A's admin.
- **The graphs match.** Every node of B equals A's export (by id, labels and properties), and so does every relationship (by id, type, ends and properties). The 2,535 tapestryKeys are the same set.
- **An earlier run, on `8fcb3d675`,** passed the same checks. It found the `[""]` admin list that `b25f6588f` fixes (Deviations).

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Backup bullet)
- Epic: [engineering-team/epics/graph-operations-foundation.md](../../epics/graph-operations-foundation.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D6, D10, D13); catalog §8
- Story 1, whose `lifecycle status` this fills in: [1-operation-declaration-and-lifecycle-status.md](1-operation-declaration-and-lifecycle-status.md)
- ADR: [engineering-team/decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md](../../decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md)
- Test plan: [2-lifecycle-backup-and-restore.test-plan.md](2-lifecycle-backup-and-restore.test-plan.md)
- Review: (filled in after Review phase)
