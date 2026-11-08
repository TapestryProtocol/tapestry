# ADR 0002: Back up and restore the whole instance — a Neo4j dump taken by a job of its own, kept as a folder, moved as one tar file

**Status:** Accepted
**Date:** 2026-11-08
**Story:** `engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md`
**Amends, for these five operations only:** ADR `security-auth-exposure/0005`, item 3 of the owner's decisions at its gate (Decision 12 below).

## Context

The story asks for five operations on the module ADR 0001 built: `lifecycle backup`, `restore`, `list-backups`, `download-backup` and `upload-backup`, all open to the owner and admins. A backup holds the whole graph, the instance assistant's key and the admin list (AC1). Restore takes a safety backup first, puts everything back exactly, and proves it against what the backup recorded (AC3). A backup moves to a fresh instance as one file (AC4), damaged or incompatible backups are refused without changing anything (AC5), and every operation is also a command inside the instance (AC6).

What the instance gives this design:

1. **Neo4j 5.26.10 Community** (`Dockerfile:41`) runs under supervisord as `neo4j console` (`docker/supervisord.conf:1–9`), with `autorestart=true` and the default 10-second stop wait. An experiment on the local image (a throwaway container with a 500-node graph and a 512 MB heap, 2026-11-08) showed:
   - `STOP DATABASE neo4j` is refused ("Unsupported administration command"). Only the whole server can be taken offline.
   - `neo4j-admin database dump` refuses a database that is in use. Stopping took 5.7 s, the dump 1.6 s (96 KB, zstd) and the start 11.9–13.6 s. A stop, load and start took 25 s.
   - `dump --to-stdout` and `load --from-stdin --overwrite-destination=true` both work. Run as user `neo4j` (`runuser -u neo4j --`), the loaded store is owned by `neo4j`.
   - `neo4j-admin database info --format=json neo4j` works only while the server is stopped, and returns `lastCommittedTransaction`, `storeFormat` and `recoveryRequired`. After a dump and a load, `lastCommittedTransaction` was the same (18).
   - `load --info --from-stdin` checks an archive without loading it, and needs no stopped server. On a good dump it exits 0 with the format, file count and uncompressed bytes (258 MB for that 96 KB dump). On random bytes it exits 1 ("Unknown frame descriptor"), and on a truncated dump it exits 1 ("Truncated source").
   - `SHOW DATABASES YIELD lastCommittedTxn` is null in Community, so a running server can't say which transaction it is at.
   - The load kept the constraint, every node, every relationship and every property type.
2. **Volumes** (`docker-compose.yml:30–34`): `/var/lib/neo4j/data`, `/var/lib/strfry`, `/var/lib/brainstorm` and `/var/log/brainstorm` survive the container being recreated. The tapestry LMDB at `/root/.tapestry` does not (BIBLE §29).
3. **The assistant's key** is `/var/lib/brainstorm/secure-keys/tapestry-assistant.json`, encrypted (aes-256-gcm, key `sha256(.master-key)`) by `SecureKeyStorage.storeRelayKeys` (`src/utils/secureKeyStorage.js:122–198`, `:296–301`) with the `.master-key` beside it. Customers' and other accounts' keys share the folder and the master key. At every start the entrypoint renders `/etc/brainstorm.conf` from the container's environment (`docker/entrypoint.sh:48–53`). `setup/create_nostr_identity.sh` then appends `BRAINSTORM_RELAY_PUBKEY` and `BRAINSTORM_RELAY_NPUB` from the key file, or makes a new key if there is none. `getOwnerAssistantPubkey()` reads `TA_PUBKEY`, then that conf line, and caches the answer for the life of the process (`src/utils/assistantKeys.js:47–80`). The normalize routes load the key when they register. Besides the control panel, only `tagging-edges-realtime` reads the assistant at start (`src/pipeline/tagging-edges/identities.js`), and the relay router's configuration doesn't name it (`src/api/strfry/routerConfig.js`).
4. **The owner** comes from the container's `OWNER_PUBKEY`, rendered into the conf at every start, so nothing inside the instance can change it for good. **The admins** come from `settings.json`'s `adminPubkeys` when that list isn't empty, and otherwise from the conf's `BRAINSTORM_ADMIN_PUBKEYS` (`src/utils/config.js:106–119`). `settings.json` (`src/config/settings.js:15–16`) is read again on every call, and `updateOverrides({ adminPubkeys })` replaces the list (`:97–102`).
5. **Writers that run on their own.** `stream-consumer` and `tagging-edges-realtime` write to Neo4j from queues and streams, and both catch up after a pause. The control panel's own routes and scheduled tasks write too.
6. **HTTP.** `express.json` and `express.urlencoded` are the only body parsers (`bin/control-panel.js:124–125`), so a body of another type reaches a route as an unread stream. The container's nginx allows 100 MB bodies and 60-second reads by default (`docker/nginx.conf:6`, `:40–46`). The droplets put a host nginx with Certbot in front of it (OPERATIONS.md, both droplets: "Behind host nginx + Certbot SSL"). The launcher's Caddy sets no body limit (`deploy/edge/Caddyfile`). **Trust:** the central check trusts a caller as direct-local only when the socket peer is loopback *and* no `X-Forwarded-For` or `X-Real-IP` header is present (`src/middleware/auth.js:355–367`). Every nginx location must therefore set `X-Forwarded-For`, or traffic through it would get local trust.
7. **The module (ADR 0001)** answers JSON only. Decision 4 makes the route answer `{ success, data }`, Decision 7 has the command print that JSON on stdout, and Decision 10 says loading opens nothing. Helper files beside a declaration, such as `_shared.js`, are ignored by the loader (Decision 1).
8. **Today's numbers.** Staging has 3,608 nodes with a uuid or id and production 3,443. Both report 0 json tags offloaded to the LMDB (`GET /api/tapestry-key/offload-status`, 2026-11-08). The node, relationship and other counts below come from `src/lib/neo4j-driver.js`'s `runCypher`, which turns Neo4j integers into numbers.

No concept is touched (story, "Concepts touched"), so there was nothing to orient on in the concept graph. On this Mac, `localhost:7778` is Grawk's private agent memory, not a dev stack.

## Options considered

### Option A — An offline Neo4j dump taken by a job of its own; a backup is a folder on the data volume, moved as one tar file *(chosen)*

Stop the Neo4j server, dump the `neo4j` database, start it again. Restore stops it, dumps the current database as the safety backup, loads the requested dump and starts it. The window when the server is down runs in a detached job process. Each backup is a folder under `/var/lib/brainstorm/backups/`; download streams the folder as a tar file, and upload reads one back.

- **Pros.** It is exact by construction: every node, relationship, property type, internal id, index and constraint, from a store at rest. It is the tool Neo4j supports, and the backup Vinney verified by restoring it. The dump is compressed (zstd). `load --info` and the store's transaction id give independent checks. A job of its own brings the server back even when its caller dies.
- **Cons.** The graph is offline for the whole window: about 20 s for a backup and 25 s for a restore on a small graph, and longer where the heap is big. During that window every request that needs Neo4j fails. A running server can't name its transaction (Context 1), so the counts a backup records are exact only when they agree before and after the window (Decision 4).

### Option B — An online logical export through Cypher, and a rebuild on restore

Page through every node and relationship while the server runs (or use `apoc.export.json.query`, the only export procedure the allowlist admits, `Dockerfile:63`), and write JSON lines. Restore creates them again with batched Cypher, and the constraints and indexes from `SHOW` output.

- **Pros.** No downtime, and no supervisord or `neo4j-admin` dependency.
- **Cons.** It isn't a snapshot: Neo4j's read-committed reads over many pages mix states while writers run. Types are lossy through JSON (integer or float, temporal types, points, byte arrays), which is the kind of mismatch the ore-parity book hit with integers. Internal ids and element ids change. Constraints and indexes need code of their own. Both directions are slow on a big graph, and the restore runs through the very write path the graph is meant to be protected from. Getting it exact is a project of its own; Option A is exact today.

### Option C — Copy the Docker volumes, or snapshot the droplet

- **Pros.** Nothing to build in the instance.
- **Cons.** It needs host access, so there is no route and nothing an admin agent can call. Files copied from a running server aren't consistent (Vinney, Loom memo #75 on A9.4: "a droplet snapshot of a running Neo4j isn't a consistent backup"). It doesn't carry the key and the admins as a unit, and launched brains have no snapshot at all unless the droplet's backups are turned on (`deploy/RUNBOOK.md:210`).

### Sub-decision — where the offline window runs: in the caller's process, or in a detached job *(chosen)*

In the caller's process, a restarted control panel (an operator's `supervisorctl restart brainstorm`, or a crash) or an interrupted command would leave Neo4j stopped. supervisord doesn't restart a program that was stopped on purpose, so the graph would stay offline until someone noticed. That would need a startup hook in the control panel and signal handling in the command, and a killed command would still strand it. A detached job (`spawn(…, { detached: true })`, its own session and process group, output to a file) finishes, and always starts Neo4j again, whatever happens to its caller. supervisord stops only the program's own process (`stopasgroup` is off for `brainstorm`), so the job survives a control-panel restart. The caller just waits for it and reads its result file.

## Decision

We chose **Option A, with the detached job**. Option B can't be exact without a project of its own, and C gives agents nothing to call. The rest of this section says exactly how.

**1. The five operations.** Each is a declaration under `src/operations/catalog/lifecycle/`, `access: 'owner-and-admins'` (Decision 12).

| Operation | Kind | Inputs | Result | Its own refusals |
|---|---|---|---|---|
| `backup` | write | `note?` (string, trimmed, 1–200 chars) | the backup's summary (Decision 3) | `busy` 409, `graph-unavailable` 409 |
| `restore` | write | `backup` (an id, required) | the restore's report (Decision 5) | `unknown-backup` 404, `damaged-backup` 422, `newer-database` 409, `not-enough-space` 409, `busy` 409, `graph-unavailable` 409 |
| `list-backups` | read | `limit?` (1–500, default 100), `before?` (an id) | `{ backups, next }`, newest first | none |
| `download-backup` | read | `backup` (an id, required) | a file: the backup as one tar (Decision 9) | `unknown-backup` 404, `too-large` 413 |
| `upload-backup` | write | none; the body is the tar file | the summary of the backup kept, with `alreadyHeld` | `not-a-backup` 422, `backup-exists` 409, `busy` 409 |

An id input has the schema `{ type: 'string', pattern: '^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$' }`. An id is never a path a caller can steer. `unknown-backup` names the ids the instance holds (newest 20), so a caller who mistyped can pick one.

**2. Where backups live.** In `/var/lib/brainstorm/backups/` (overridable by `TAPESTRY_BACKUPS_DIR`, for tests), on the volume that survives a recreated container. The folder is mode `0700`, and every file in it `0600`, owned by root.

```
backups/
  20261108T201500Z-1a2b3c4d/      one backup; its name is its id
    manifest.json                 written last: a folder without one is incomplete and never listed
    neo4j.dump                    the neo4j database, from neo4j-admin database dump
    admins.json                   { pubkeys, from: 'settings' | 'launch-settings' }
    identity/tapestry-assistant.json   copied byte for byte from secure-keys/
    identity/master-key                copied byte for byte from secure-keys/.master-key
    received.json                 only on an uploaded backup: { receivedAt, by }
  .lock                           one backup, restore or upload at a time (Decision 7)
  .runs/<runId>.json, .runs/<runId>.log   each job's request, result and log (Decision 8)
  .incoming-<runId>/              an upload being received (Decision 9)
```

The id is `YYYYMMDDTHHMMSSZ-<8 hex>`, the UTC time it was taken plus four random bytes. That is the form tagging-edges run ids already use, and it sorts by time. The size reported for a backup is the sum of its files.

**3. The manifest.** The JSON every other part reads, checked by an ajv schema in `_store.js`:

```js
{
  format: 'tapestry-backup', version: 1,
  id, takenAt /* ISO */, note /* string | null */,
  reason: 'requested' | 'before-restore', restoring /* id | null: what a safety backup was taken before */,
  instance: { assistantPubkey, ownerPubkey /* at the time; may be 'unassigned' */ },
  admins: { pubkeys: [...], from: 'settings' | 'launch-settings' },
  graph: {
    neo4jVersion /* '5.26.10' */, storeFormat, lastCommittedTransaction /* from info, while stopped */,
    nodes, relationships, tapestryKeys, distinctTapestryKeys,
    tapestryKeyDigest /* 'sha256:' + hex of the sorted keys joined by '\n' */,
    countsExact /* Decision 4 */, offloadedJsonTags,
  },
  offlineMs,
  files: { 'neo4j.dump': { size, sha256 }, 'admins.json': {...}, 'identity/tapestry-assistant.json': {...}, 'identity/master-key': {...} },
}
```

The backup's answer (AC1) is `{ backup: { id, takenAt, note, size, origin: 'taken', reason }, holds: { nodes, relationships, tapestryKeys, countsExact, assistantPubkey, ownerPubkey, admins, offloadedJsonTags }, graph: { neo4jVersion, storeFormat, lastCommittedTransaction }, offlineMs, warnings }`. `list-backups` returns the same summary for each backup, plus `origin: 'uploaded'` with `receivedAt` where `received.json` exists, and `sameInstance` (whether its assistant is this instance's). A warning is one sentence, for example when json tags are offloaded to the LMDB, which a backup doesn't carry, or when the counts aren't exact.

**4. Taking a backup.** The declaration refuses `busy` (Decision 7) and `graph-unavailable` (no answer to `RETURN 1` within 5 s), then starts the job. The job:

1. Pauses the writers that run on their own: `supervisorctl stop stream-consumer tagging-edges-realtime`, for those of the two `supervisorctl status` shows running. It starts them again in step 7, or in its `finally`.
2. Counts **before** (S1): `MATCH (n) RETURN count(n)`, `MATCH ()-[r]->() RETURN count(r)` (both from Neo4j's count store), every `n.tapestryKey` that isn't null (counted, counted distinct, sorted, hashed), and `MATCH (t:NostrEventTag) WHERE t.value STARTS WITH 'lmdb:' RETURN count(t)`. Also `CALL dbms.components()` for the version.
3. Reads the identity and the admins (Decision 6), and writes `admins.json` and `identity/*`.
4. Stops the server (`supervisorctl stop neo4j`), and marks the lock `stage: 'offline'`.
5. Runs `neo4j-admin database info --format=json neo4j` as user `neo4j`. If `inUse` is `"true"` or `recoveryRequired` is `"true"`, the job fails and starts the server. Otherwise it keeps `lastCommittedTransaction` and `storeFormat`, then runs `neo4j-admin database dump neo4j --to-stdout` as `neo4j`, piping it into `neo4j.dump` while hashing it, with stderr captured to the run's log.
6. Starts the server (`supervisorctl start neo4j`), waits until `RETURN 1` answers (polling every second for up to 300 s), and marks the lock `stage: 'online'`. `offlineMs` runs from the stop to that first answer.
7. Counts **after** (S2), the same way, then starts the paused writers.
8. Writes `manifest.json`, with `countsExact = (S1 equals S2)` and the counts of S1. No write can reach the graph while the server is down, so the dump is the state between S1 and S2. When they agree, it is that state, short of writes that cancel each other out, which the paused writers make unlikely. When they disagree, the manifest keeps S1, `countsExact` is false, and a warning says the graph changed while the backup was taken.

On any failure the job's `finally` starts the server if it stopped it, starts the paused writers, removes the incomplete folder, and records the failure in its result. The caller then answers `failed` (500) with that sentence.

**5. Restoring.** The declaration checks everything before it changes anything:

- **`unknown-backup`:** the folder or its `manifest.json` is missing.
- **`damaged-backup`:** the manifest fails its schema; a file it lists is missing, or its size or sha256 differs; `load --info --from-stdin` rejects `neo4j.dump`; or the identity doesn't decrypt to `instance.assistantPubkey` (Decision 6).
- **`newer-database`:** the backup's Neo4j major version differs from this instance's, or its version is newer (from `neo4j-admin --version`).
- **`not-enough-space`:** the volume holding `/var/lib/neo4j/data` has less free space (`fs.statfs`) than the archive's uncompressed size, as `load --info` reports it.
- **`busy`** and **`graph-unavailable`**, as for backup.

Then the job, in **one** offline window:

1. Pauses the writers, as backup does. Counts S1 and reads the current identity and admins, for the safety backup.
2. Stops the server. Runs `info`, then dumps the current database into a new backup folder: the **safety backup**, `reason: 'before-restore'`, `restoring: <id>`, note "Safety backup taken before restoring <id>". Its counts are S1 with `countsExact: false`, since the graph can't be counted again after the load. If this dump fails, the job starts the server and fails, and nothing has changed.
3. Loads the requested dump: `neo4j-admin database load neo4j --from-stdin --overwrite-destination=true`, as `neo4j`, fed from `neo4j.dump`. Then runs `info`: the loaded store's `lastCommittedTransaction` must equal the manifest's. If the load fails or the transaction differs, the job loads the safety dump back the same way (the rollback), starts the server, and fails with a sentence saying it rolled back. If the rollback load also fails, the sentence names the safety backup and the command that loads it by hand.
4. Starts the server and waits for it, as backup does. Counts the restored graph, S3.
5. Puts the identity and the admins in place (Decision 6), then starts the paused writers. That also restarts `tagging-edges-realtime` with the new key.

The report (AC3):

```js
{
  restored: <id>, safetyBackup: <id>,
  graph: {
    transaction: { recorded, loaded, same: true },
    counts: { recorded: {...} /* the manifest's */, restored: {...} /* S3 */, exact /* manifest.countsExact */, match /* true | false | null when not exact */ },
  },
  assistant: { before, after, changed },
  owner: { backup, instance, same },
  admins: { before: [...], after: [...] },
  offlineMs, restarting: [...], warnings: [...],
}
```

`match` compares nodes, relationships, tapestryKeys, distinct tapestryKeys and the digest. When it is false, a warning names what differs and the safety backup to go back to. When the owner differs, a warning says the owner stays as this instance's launch settings name it.

**6. The assistant's key and the admin list.**

- **Backup** copies `tapestry-assistant.json` and `.master-key` byte for byte. It first checks that `new SecureKeyStorage({ storagePath, masterKey })` decrypts the copy and returns `instance.assistantPubkey` (from the conf line, as `getOwnerAssistantPubkey` reads it). It writes `admins.json` with the effective list from `getAdminPubkeys()`, and `from: 'settings'` when the list came from settings.
- **Restore** reads the backup's key with a `SecureKeyStorage` keyed to the backup's own master key (`getRelayKeys('tapestry-assistant')`). It stores it with one keyed to this instance's master key (`storeRelayKeys('tapestry-assistant', { privkey, nsec, pubkey, npub })`), written to a temporary file and renamed into place. **This instance keeps its own master key,** so the other keys in the folder still decrypt. It rewrites the conf's `BRAINSTORM_RELAY_PUBKEY` and `BRAINSTORM_RELAY_NPUB` lines (adding them if missing) through a temporary file, keeping its mode, so the running processes and the next start agree. After the next container start, `create_nostr_identity.sh` finds the restored key file and keeps it. Then restore sets `updateOverrides({ adminPubkeys: backup.admins.pubkeys })`. An empty backup list falls back to this instance's launch settings, and a warning says so. When `TA_PUBKEY` is set in the environment, it outranks the key file, and a warning says so.
- **When the assistant changed,** the control panel must start again to drop its cached key. The declaration registers `context.afterAnswer(() => restartControlPanel())` (Decision 10). Over HTTP, that runs once the response has finished or closed, as a detached `supervisorctl restart brainstorm`. From the command, it runs before the command exits. The report's `restarting` lists `brainstorm` and `tagging-edges-realtime`. A restored admin list needs no restart, since settings are read on every call.

**7. One at a time.** `.lock` is created with `open(…, 'wx')`, holding `{ runId, op, host: os.hostname(), holders: [{ pid, startTime }], stage, backup, startedAt }`. `startTime` is field 22 of `/proc/<pid>/stat`, where that exists. The caller writes it, the job adds itself, and the job removes it in its `finally`. The caller removes it too, if the job died without doing so.

- **A lock is stale** when its host differs (a recreated container) or no holder is alive with the same start time.
- **The next backup, restore or upload** that finds a stale lock recovers before it takes its own. If the stale stage was `offline`, it starts the server and the writers. It removes any folder without a manifest that the lock names, and records the run as `interrupted`.
- **Upload** refuses `busy` while a backup or restore holds the lock. It doesn't take the lock itself: its folder appears only by an atomic rename (Decision 9), so a backup or restore may run while an upload is still arriving.

**8. The detached job.** `_jobs.js` exports `runBackupJob(request, system)` and `runRestoreJob(request, system)`, which hold the sequences of Decisions 4 and 5, and `runDetached(request)`.

- **`runDetached`** writes `.runs/<runId>.json` with the request. It spawns `process.execPath _worker.js <runId>` with `detached: true`, stdout and stderr to `.runs/<runId>.log`, and the caller's environment. It waits for the job's exit, then reads the result from the same file.
- **`_worker.js`** runs the job with the real `system` and writes `{ outcome: 'done' | 'failed', result | error, finishedAt }` into its run file. It closes the Neo4j driver and exits.
- **The command** prints, on stderr: "This backup runs as a job of its own. If this command is interrupted, the job still finishes, and `tapestry lifecycle status` shows how it went."
- **`system`** (`_system.js`) is every outside effect: `supervisor(action, programs)`, `programStatus(names)`, `neo4jAdmin(args, { stdin, stdout })` run through `runuser -u neo4j --`, `cypher`, `version()`, `freeBytes(path)` and `sleep`. A suite replaces it, as status's `parts` are replaced (ADR 0001 Decision 11), and calls the jobs in-process.

**9. Download and upload: the archive.** One POSIX ustar file, written and read by `_tar.js`, about 150 lines with no dependency.

- **Members, in order:** `manifest.json`, `admins.json`, `identity/tapestry-assistant.json`, `identity/master-key`, `neo4j.dump`. Each is a regular file with mode `0600`, uid and gid 0 and mtime `takenAt`, and the archive ends with two zero blocks. Because the sizes are known, the download's `Content-Length` is computed before streaming.
- **The size limit** is the 11 octal digits of a ustar size field: a dump under 8 GiB. A larger backup's download refuses `too-large`.
- **Upload** reads the request body as it arrives into `.incoming-<runId>/`, hashing each member. It refuses `not-a-backup` for a bad header checksum, an unexpected name (a leading `./` is accepted), a type other than a regular file (a directory entry `identity/` is skipped), a member that appears twice, a missing member, a size or sha256 that differs from the manifest, a manifest that fails its schema, a dump `load --info` rejects, or an identity that doesn't decrypt. Then it renames the folder to `<id>/`. If `<id>/` already exists with the same checksums, the answer is `alreadyHeld: true`; with different ones, the upload refuses `backup-exists`. It writes `received.json` with `{ receivedAt, by }` (the caller's pubkey, or `'local'`). Its `finally` removes the incoming folder. A refused upload changes nothing.

**10. The module grows file results and file bodies.** These are extensions to ADR 0001's module, which its Consequences allow for later foundation tasks.

- **`declaration.js`.**
  - `result` is either `{ description?, schema }` or, for a read only, `{ description?, file: { contentType } }`.
  - A write may declare `body: { file: { contentTypes: [...], maxBytes } }`. Its body is then the file, its declared inputs come from the query string, and it gets two built-in refusals, `wrong-content-type` (415) and `too-large` (413), instead of `invalid-body`.
  - Both are checked like every other rule (Decision 9 there).
- **`index.js` `callOperation`.** A file result's `run` returns `{ file: { name, size, contentType, open } }`, where `open()` returns a readable stream. `callOperation` returns `{ status: 200, file }` for it, and refuses a file result that lacks one. `context` gains `body` (the readable stream, for a file body) and `afterAnswer(fn)`. A read declared with a file result that returns anything else is a 500 `failed`.
- **`http.js`.**
  - For a file body it checks the `Content-Type` and the `Content-Length` (when present) before running, wraps `req` in a counter that ends the stream with `too-large` past `maxBytes`, and passes the query string as the inputs.
  - For a file result it sets `Content-Type`, `Content-Length`, `Content-Disposition: attachment; filename="<name>"`, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, then pipes the stream. An error after the headers are sent destroys the response.
  - It runs the `afterAnswer` functions once, on the response's `finish` or `close`.
- **`cli.js`.**
  - A file result streams to stdout. When stdout is a terminal, the command refuses with usage (exit 2): "Send the backup to a file: `tapestry lifecycle download-backup --backup <id> > backup.tar`".
  - A file body reads stdin, and refuses with usage (exit 2) when stdin is a terminal.
  - It runs the `afterAnswer` functions before it exits. `main`'s `io` gains `stdin`.
  - From the host this gives `docker exec tapestry tapestry lifecycle download-backup --backup <id> > backup.tar` and `docker exec -i tapestry tapestry lifecycle upload-backup < backup.tar`.
- **`openapi.js`.** A file result's 200 has `content: { <contentType>: { schema: { type: 'string', format: 'binary' } } }`, and a file body's `requestBody` has one such entry per allowed type.
- **The list** (ADR 0001 Decision 8) carries `result.file` and `body`, so A10.6's external CLI knows to stream.

**11. `lifecycle status` and `list-backups`.** Status's `parts.backup` (`status.js`) reads `_store.js` and answers:

```js
{ known: true, last: { id, takenAt, note, size, origin, reason } | null, count, lastRun: { runId, op, outcome, finishedAt, backup } | null, interrupted: { runId, op, startedAt } | null, note }
```

`note` says what it knows, in words: none taken yet, the last one, or an interrupted run. Its result schema changes with it, and it still writes nothing. `list-backups` reads each complete folder's manifest, newest first, `limit` at a time. `before` lists backups older than that id, and `next` is the id to pass for the next page, or null.

**12. Who may call, and what it changes.** Every operation is `owner-and-admins`, so the route table gives each one `access: 'owner'` (ADR 0001 Decision 3). The command runs them as a local caller.

At the owner's ruling of 2026-11-08 (story, open questions 1 and 4), admins may download the assistant's secret key and restore the key and the admin list. That amends ADR `security-auth-exposure/0005` for these five operations only. Its item 3 made two things owner-only, checked in their own handlers: signing as the assistant through `POST /api/strfry/publish`, and changing the admin list through a settings update or reset. Both checks stay as they are on their own routes.

ADR 0005 gets a line under its header pointing here.

**13. nginx and supervisord.**

- **`docker/nginx.conf`** gets a `location /api/tapestry/lifecycle/` block with:
  - `proxy_pass http://127.0.0.1:7778;`, plus `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`, `proxy_set_header Host $host;` and `proxy_http_version 1.1;`, as `/` has (Context 6: **without the forwarded header, outside traffic would be trusted as local**);
  - `client_max_body_size 9g;`, `proxy_request_buffering off;` and `proxy_buffering off;`;
  - `proxy_read_timeout 900s;` and `proxy_send_timeout 900s;`.
- **`docker/supervisord.conf`'s `[program:neo4j]`** gets `stopwaitsecs=120`, `stopasgroup=true` and `killasgroup=true`. Then a long checkpoint at shutdown isn't killed after the default 10 s, and the stop reaches the server JVM as well as its launcher. Step 5's `info` check backs this up: the job never dumps a store that is still in use or that needs recovery.

## Consequences

**What this enables**

- The whole self, never-published nodes included, can be backed up, moved and restored by the owner or an admin agent, through the routes, the command or the files. OPEN.md row 281 (event-less sets have no backup) is answered.
- A10.3 can take a backup before it migrates every node, and `lifecycle wipe` (A10.38) can require one.
- Every later operation may return a file or take one (Decision 10), which `export file` and `import file` will need.

**What this constrains**

- **A backup takes the graph offline.** On the experiment's small graph that was about 20 s, and it is longer where the heap is large. Requests that need Neo4j fail during the window, and so do scheduled tasks that run in it. The two writers that run on their own are paused and catch up.
- **The operations run only where they can act as root** with supervisord, `runuser` and `neo4j-admin`: the Docker image. On another install the job fails with the command's own error.
- **Through the droplets' host nginx,** an upload larger than its body limit (nginx's default is 1 MB) is refused, and a backup or restore that outlasts its read timeout (default 60 s) loses its answer, though the job finishes and `lifecycle status` reports it. An operator raises both for `/api/tapestry/lifecycle/` on each droplet when this ships (Implementation notes, OPERATIONS.md).
- **The control panel's own request timeout** (Node's default `requestTimeout`, 5 minutes, which `bin/control-panel.js` doesn't change) bounds an upload: at 10 MB/s, about 3 GB.
- **A downloaded backup is a key.** The assistant's key is encrypted with a master key that travels beside it, so in effect it is plain. Anyone with the file can sign as the instance.

**New debt and follow-ups**

- **No deletion or rotation.** Every restore adds a safety backup, and backups build up on the data volume until someone removes them from a shell. Follow-up: `lifecycle delete-backup` and a rotation rule.
- **The cache isn't rebuilt** after a restore. Entries for nodes whose graph state went back can be newer than the graph until `cache rebuild` (catalog §7) runs, and the report's warnings say so.
- **A restored instance's relay** holds what its own first boot signed, under the key it no longer has. Nothing reads those letters as the instance's own, since its assistant is the backup's now.
- **Encryption and the mirror relay** (BIBLE §30's pipeline, the catalog's `target?`) remain open.
- **Docker image paths change** (`docker/nginx.conf`, `docker/supervisord.conf`), so merging to staging rolls the brain images, and a long-running local container needs a rebuild to get the nginx block and the stop settings.
- **BIBLE §30's status lines** ("Backup mechanics … Deliberately open") are ratified when the book closes, with the rest (design §8).

**Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

**New files** (helpers start with `_`, so the loader ignores them):

- `src/operations/catalog/lifecycle/backup.js`, `restore.js`, `list-backups.js`, `download-backup.js`, `upload-backup.js` — the five declarations (Decision 1). Each `run` requires its helpers lazily (ADR 0001 Decision 10).
- `_store.js` — the paths (`TAPESTRY_BACKUPS_DIR`, `TAPESTRY_SECURE_KEYS_DIR`), new ids, the manifest schema, `readBackup(id)`, `verifyBackup(id, system)`, `listBackups({ limit, before })`, `latest()`, the lock (`acquire`, `release`, `inspect`, stale recovery) and the run files.
- `_system.js` — the real `system` (Decision 8). `cypher` uses `src/lib/neo4j-driver.js`'s `runCypher`; the worker calls `closeDriver()` before it exits.
- `_identity.js` — `readIdentity()`, `checkIdentity(folder, expectedPubkey)`, `restoreIdentity(folder)` and `readAdmins()` / `restoreAdmins(list)` (Decision 6), plus `restartControlPanel()`. `BRAINSTORM_CONF_PATH` (already read by `getConfigFromFile`) and `TAPESTRY_SETTINGS_PATH` point them at test files.
- `_tar.js` — `archiveSize(members)`, `writeArchive(members, out)` and `readArchive(stream, { onMember })` (Decision 9).
- `_jobs.js` and `_worker.js` (Decision 8).

**Changed files:**

- `src/operations/declaration.js`, `index.js`, `http.js`, `cli.js`, `openapi.js` — Decision 10. `bin/tapestry.js` passes `process.stdin` in `io`.
- `src/operations/catalog/lifecycle/status.js` — `parts.backup` and its schema (Decision 11). A10.3 edits the same file for migrations, so the two land one after the other (Loom memo #97).
- `docker/nginx.conf`, `docker/supervisord.conf` — Decision 13.
- Docs, by the Implementer:
  - **OPERATIONS.md** gets a short "Backups" section: what a backup holds, where it lives, the commands from the host, that a downloaded backup is a key, and the host-nginx raise each droplet needs before uploads over 1 MB or long runs work through its public name (`client_max_body_size` and `proxy_read_timeout` for `/api/tapestry/lifecycle/`).
  - **ADR `security-auth-exposure/0005`** gets an "Amended for five operations by: graph-operations-foundation/0002 (2026-11-08)" line.
  - **`docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md`**'s Status line, which still says nothing is built, now names A10.1 and A10.2.

**For the Tester** (Phase 3's lane, not the Implementer's):

- The suites go in `test/operations/lifecycle/<name>.test.js`; one registered suite discovers them (ADR 0001 Decision 12).
- `test/operations/lifecycle/status.test.js` expects the old backup part, `{ known: true, last: null, note }`, so it changes with Decision 11.
- The module's own suite covers file results and file bodies.
- Static checks cover the two Docker config files, the nginx block's `X-Forwarded-For` above all.
- The jobs are tested in-process with a fake `system` and temporary folders. The live path is the scratch-stack check the story's AC4 describes: two boots in turn, a download from the first, an upload to the second, and a restore. It needs `bin/tapestry.js` copied in, since `scripts/scratch-stack.sh` mounts only `src/`.

**Never log key material.** Not in the run's log, an answer or a warning. `storeRelayKeys` logs only an account name.

## Out of scope

- Encrypting a backup, and the mirror relay (BIBLE §30). The catalog's `target?` input waits for that second target.
- Deleting and rotating backups; backups on a schedule; any UI.
- The relay's events, the cache store, customers' and other accounts' keys, the session secret, the router's configuration and the rest of the settings (story, Out of scope).
- Changing the owner. Restore reports a different one.
- Online backup, and restoring part of a graph.
- Making the droplets' host nginx part of the repo. Its two settings are an operator's step, written in OPERATIONS.md.

## Amendment 1: fixes from review round 1 (2026-11-08)

Review round 1 (`engineering-team/reviews/graph-operations-foundation/2-lifecycle-backup-and-restore.md`) found one blocking gap in Decision 6. The control panel was restarted after an assistant-changing restore only if the restore's caller was still there:
- over HTTP, `afterAnswer` work was registered after the job finished, so a client that had already gone never set it off;
- an interrupted command never reached it.

The instance then kept the old assistant cached while the key file, the conf and the admins were the backup's. The owner approved the fix below with the round's smaller fixes ("Fix it, with the extras", 2026-11-08).

**A1. The job restarts the control panel, once the answer is out or its caller is gone.** This replaces Decision 6's last point.
- **The request names its caller.** `runDetached` writes `callerPid: process.pid` into the request.
- **The worker waits, then restarts.** After a job whose result asks for a restart (`restarting` includes `brainstorm`), `_worker.js` calls `afterJob(record, system)`. It waits, polling the run file every 500 ms for at most 120 s, until one of these holds:
  - the caller has marked the run answered (`answeredAt`);
  - the caller's pid is gone;
  - the 120 s are up.

  Then it calls `system.supervisor('restart', ['brainstorm'])` once and records `restartedAt`.
- **The restore declaration** registers `context.afterAnswer(() => markAnswered(runId))` instead of the restart itself.
- **One rule covers both callers.**
  - Over HTTP the caller is the control panel. It marks the run once the response is out, so the restart can't cut the answer short.
  - From the command the caller is the command's own process. It marks the run before it exits, or, if Ctrl-C ends it first, the worker sees its pid gone.

**A2. After-answer work runs at once when the response has already finished or closed** (amends Decision 10). A client that gave up before the answer no longer suppresses the work.

**A3. Smaller fixes**, each from the round's non-blocking findings:
- **If the job can't be started, its lock is released.** `runDetached` removes the request's lock and resolves `{ outcome: 'failed', error }` when the run file or the spawn fails before the job starts.
- **Recovery removes only the lock it found stale.** After its own steps it releases by `runId`, never by path, so a fresh lock taken meanwhile stays.
- **What to undo is recorded before the call that needs undoing.** The jobs note the writers as paused, and the server as stopped, before calling `supervisorctl stop`, so a stop that fails halfway is still undone.
- **The restore's errors say where things stand.**
  - When a step after the load fails, the error says the backup's graph is in place and names the safety backup.
  - When the rollback itself fails, the by-hand command says to stop the server first and start it after.
- **The dump's and the load's last output line goes to the run's log,** as Decision 4 step 5 intended.
- **Restore's result schema** names the report's fields.
- **The rest:**
  - an aborted download stops reading its file;
  - the restored npub is always derived from the key;
  - an interrupted restore's status names its safety backup.
- **Recorded, not changed.**
  - The free-space check is skipped when `load --info` prints no `Bytes:` line; 5.26.10 prints one (Context 1).
  - The control panel's CORS posture, which lets a same-site page read what a signed-in owner may, is added to OPEN.md row 326, where it already lives.

**A4. Four of the round's points still open after A1–A3** (added 2026-11-08, before review round 2):
- **A restore that fails after the restored key went in restarts the control panel too** (non-blocking 2). This extends A1.
  - When a step after `restoreIdentity` fails (the admins, or starting the writers) and the assistant changed, the error carries `restarting: ['brainstorm']` and says the control panel restarts.
  - `_jobs.js` gets `runJob(request, system)`, which runs the job and makes its record. The worker calls it, and it copies a failure's `restarting` into the failed record.
  - `afterJob` restarts on a failed record's `restarting` as on a done record's `result.restarting`, with the same wait.
  - Without this, the key file and the conf name the backup's assistant while the running control panel keeps the old one.
- **Only the upload takes a backup-sized body** (non-blocking 6). This amends Decision 13.
  - The `location /api/tapestry/lifecycle/` block keeps the server's body limit (100m).
  - A `location = /api/tapestry/lifecycle/upload-backup` block has the same headers, buffering and timeouts, plus `client_max_body_size 9g;` and `proxy_request_buffering off;`.
  - OPERATIONS.md's block for the droplets' host nginx is split the same way.
- **The lock appears whole** (non-blocking 8). This amends Decision 7's `open(…, 'wx')`.
  - `acquireLock` writes the lock to a temporary file beside it and links that into place. The link fails when a lock exists, as `wx` did.
  - So a reader never finds the lock empty and judges it stale.
- **The worker runs nothing when the lock isn't its run's** (non-blocking 8). This amends Decision 8.
  - When `addHolder` finds another run's lock, or none, the worker records the run as failed, saying so, and exits.
  - It touches neither the system nor the lock.
