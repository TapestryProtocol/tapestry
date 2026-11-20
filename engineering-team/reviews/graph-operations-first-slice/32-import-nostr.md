# Review: Story 32 — `import nostr`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-20
**Diff:** `git diff 3c5449b2..eefc8299`: 29 files, +6166 −8. These are four local commits, not pushed:
- `3af64502`: the tests, the test plan, and their helpers (the Cypher engine, its graph fake, the relay and DNS fakes, the fixtures, and the harness hooks);
- `233b7db4`: the implementation (`src/operations/catalog/import/nostr.js`, `_relay.js`, `_letters.js`) and four entries in `test/operations/lifecycle/nostr-event-lookups-kept.json`;
- `6525d2d2`: catalog §5, BIBLE §6 and §11, the skill's line, the ledger row for today's importers, and the story's Deviations and suite evidence;
- `eefc8299`: the live check's evidence and three more ledger rows.

**Against:**
- the story, [32-import-nostr.md](../../stories/graph-operations-first-slice/32-import-nostr.md), as changed at Architecture and at Test Design;
- [ADR 0032](../../decisions/graph-operations-first-slice/0032-import-nostr.md) (`9cabc873`), Decisions 1–13, the six story amendments, and the Test Design amendment `3c5449b2`. Both are in ADR PR #162, which the owner approved and has not merged;
- the [test plan](../../stories/graph-operations-first-slice/32-import-nostr.test-plan.md);
- the live check's records in the main checkout's ignored `tmp/live-check-32/`, read only (`keys.json` wasn't opened).

**How it was made.** A reviewer agent with no Edit access wrote this review at the session's request.
- It ran every suite itself, stack-free, after `. tmp/a10-32/env.sh`. That puts stub `curl` (exit 7) and `docker` (exit 1) first on `PATH`, points every service endpoint at a dead port, sets `TAPESTRY_CONTAINER=no-such-container` and unsets `TAPESTRY_CONTAINER_PORT`. It never ran `npm test`, `docker`, or a call to the local stack, GitHub or Loom.
- Its probes are in the ignored `tmp/review-32/`:
  - `relay-experiments.js` and `run-crash.js`, each run with Node 22.23.1 (the container's major version) against a `ws` server on a random 127.0.0.1 port;
  - their outputs, `relay-close.out`, `relay-stray.out` and `run-crash.out`;
  - the suite runner and its log (`suites.sh`, `suites.out`), and the gate's output (`gate-review.out`).
- `git status` in the worktree was clean after every run.
- The independent check before the commit (workflow 5, P13) wasn't applied.

**Verdict:** CHANGES_REQUESTED: one blocking finding and nine non-blocking.

**Round 2** (2026-11-20, at `42eaaeca`): PASS. See the end of this file.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`) was not run. On this Mac the local stack is the owner's live agent-memory instance, and the full suite writes to it. CI's stack-free job runs it on the pull request.
- [x] **The scoped gate:** `zsh tmp/a10-32/gate.sh a10-32-review` at `eefc8299`, a clean tree. It runs CI's five entries for an operations change through `test/helpers/gateRunner.js`. Its `npm run gate:status -- --label a10-32-review` line, with the path shortened:

  ```
  20261120T143150Z-25299-4d58 [a10-32-review] started 2026-11-20T14:31:50.691Z on eefc8299 — PASS, exit 0, 1351 passed, 0 failed, 12 skipped, 5/5 suites · …/tmp/gate-runs/20261120T143150Z-25299-4d58.json
  ```

  By entry:

  | Entry | Passed | Failed | Skipped | Time |
  |---|---|---|---|---|
  | `operations` | 1,250 | 0 | 10 | 240 s |
  | `external-cli` | 53 | 0 | 0 | 11 s |
  | `openapi-coverage` | 13 | 0 | 0 | 2 s |
  | `admin-action-sweep` | 9 | 0 | 0 | 0.5 s |
  | `schema-save-finds-the-right-header` | 26 | 0 | 2 | 18 s |

  The totals match the Implementer's record `20261120T140500Z-7070-17fd`: 1,351 passed, 0 failed, 12 skipped.
- [x] **Each suite of `test/operations/import/` alone,** with `tmp/review-32/suites.sh`:

  | Suite | Passed | Failed | Skipped | Time |
  |---|---|---|---|---|
  | `nostr` | 14 | 0 | 0 | 1 s |
  | `nostr-record` | 15 | 0 | 0 | 1 s |
  | `nostr-order` | 11 | 0 | 0 | 5 s |
  | `nostr-own` | 7 | 0 | 0 | 2 s |
  | `nostr-graph` | 10 | 0 | 0 | 1 s |
  | `nostr-filter` | 8 | 0 | 0 | 2 s |
  | `nostr-relay` | 7 | 0 | 0 | 23 s |
  | `nostr-agent-through-cli` | 1 | 0 | 0 | 1 s |
  | `nostr-live` | 0 | 0 | 6 | 0 s (its live checks skip, as they should) |
  | `cypher-engine` | 11 | 0 | 0 | 0 s |

  That is 73 feature tests passing, as the Evidence says.
- [x] **`tapestry-key-paths` alone:** 20 passed, 0 failed (G9, G11, G18 and G19 among them). It is `test/operations/lifecycle/tapestry-key-paths.test.js`; the brief's `test/tapestry-key-paths.test.js` doesn't exist.
- [x] **`bash scripts/harness-lint.sh`:** clean, 0 violations.
- [ ] _Playwright: not applicable (no UI)._
- [ ] _Lint, typecheck and build are not configured._

## Spec adherence

- [x] **Every acceptance criterion has passing tests.** Every id in the plan's coverage map is in its suite: IN1–IN14, IR1–IR15, IO1–IO11, IW1–IW7, IG1–IG10, IF1–IF8, IL1–IL7 and XI1, with LV1–LV6 live. AC7's run by hand is LH1 (`hand-calls.md`, calls 01–11). Its claims check against `calls/03-header-rels.out`, `03b-pp-rels.out` and `07b-target-refs.out`.
- [x] **No criterion is silently dropped.** Two hold only within limits already on record:
  - AC3's "two imports at once make one node" needs the uniqueness rules (non-blocking 3);
  - AC5's "none is skipped" carries the owner's Test Design limit.
- [x] **No behaviour beyond the story** but the logged deviations. Each was checked against the code (item 1 of the brief):
  1. **The event's node is a `CREATE`.** Accepted, and it is sounder than the ADR's `MERGE`. Under the rule, a `MERGE` would block on the first import's index entry, then match its node. It would then write the second import's version over it uncompared, which could be an older one. A `CREATE` fails instead, and Decision 7.9's second run re-reads and compares. Without the rule, neither keeps one node.
  2. **The address placeholder is a `CREATE`.** Accepted. It is made only when `resolveEnds` found no `NostrEvent|TapestryNode` at the address (`_letters.js:451-455`), so there is nothing for G9's adoption to adopt.
  3. **Four entries in `nostr-event-lookups-kept.json`.** Accepted. Each names its line exactly, and each reason matches the code:
     - the id lookup (`_letters.js:279`): only an event's node or a placeholder holds an `id`;
     - the event's `CREATE` (`:289`) and the address placeholder's (`:332`): a `CREATE` can't take a label disjunction;
     - the placeholder by id (`:337`).
     
     Stories 3 and 44 extended this registry in their implementation commits too, and G11 and G18 pass.
  4. **The `z` wiring leaves out the instance's own nodes** (`_letters.js:377`). Accepted. Decision 8 lets a relationship touch an own node only as a membership *from* the own superset or set, or as a reference *to* it. A foreign superset's `HAS_ELEMENT` into an own node is neither, and AC6 and IW6 forbid it. The `WHERE` (`m.pubkey IS NOT NULL AND NOT m.pubkey IN $own`) is exactly `factsOf`'s test of an own event node (`reads.js:215`). BIBLE §6 doesn't say so yet (non-blocking 6).
  5. **A graph's `invalid` and `unread` outcomes.** Accepted. Both are in the answer's enum, and an `unread` graph is also named under `next.graphs` (`nostr.js:442`).
  6. **`ref` for a graph's letters.** Accepted: it is what the call asked the relay for.
  7. **A graph letter re-recorded when followed** (`nostr.js:428-434`). Accepted. This branch is untested, as the deviation says, and one gap in it is non-blocking 9.
  8. **The 40 s budget covers ids and addresses.** Accepted for requests (`nostr.js:345`). Recording isn't bounded by it (non-blocking 5).
  9. **Pages and sweeps of 500; a non-integer `created_at` answered `invalid`** (`nostr.js:500-504`). Accepted.
  10. **`failed` for a newer replaceable version blocked by today's per-version node.** Accepted. The only alternatives are deleting a node today's builders made, which may hold what the owner added, or a second node at one id. Decision 7.4 leaves that node where it is, and the ledger row lists the case.

## ADR adherence

- [x] **Files match the implementation notes.** There are three new files under `src/operations/catalog/import/`, and nothing in `src/api/` or `src/firmware/` changed.
- [x] **Layering.** It uses `run`, not the write path, and each event runs in its own `graph.writeTransaction` with its change entry (Decisions 7.8 and 10). The relay host guard is required inside `run` (`nostr.js:248`), and `_relay.js`'s `connect` is called through its exported object.
- [x] **No new dependencies.** nostr-tools 2.10.4 and ws 8.18.1 are already direct dependencies, and `nostr-tools/abstract-relay` is the package's own export. `package.json` and the lockfile are unchanged.
- [x] **The statements** are parameterized. The only text spliced in is a label from `LABELS` or a name matching `TYPE` (`_letters.js:284-287, 343-346`); a structure claim's type must also be in `structureTypes()` (`:239-241`).

## Concept-graph integrity

- [x] **Handles.** No handle or pubkey literal was added under `src/`. The class-thread types come from `_concepts.rel()`, and the own keys from `ownKeys()` at run time (`nostr.js:157`).
- [x] **Firmware reinstall:** not needed. No concept definition changed, and `firmware/` is untouched (ADR Consequences).
- [x] **Orientation:** not applicable. The allowed relationship types are read from firmware's files, as `relationship-type-allowed` reads them (ADR Context 7).

## Things tests can't catch

- [x] **No secrets in committed files.** The suites' keys are the sha256 of fixed labels (`test/helpers/importFixtures.js:65-68`), or fresh for each run (the agent suite). The live check's `keys.json` is mode 600 in the ignored `tmp/`, uncommitted.
- [x] **No debug output.** No `console.*` was added under `src/`, and NOTICEs are silenced (`_relay.js:73`).
- [x] No commented-out code, and no TODOs.
- [ ] **Error paths.** A relay that drops the connection during a call kills the process (Blocking 1). A connect that times out can leave an open socket (non-blocking 2).
- [x] **Concurrency.** Two imports of one event make one node under the uniqueness rules (LV3 on live run 2), but not without them (run 1; non-blocking 3). Deadlocks are run again by `executeWrite`, and a uniqueness failure by Decision 7.9's second run. An import and a graph write meet only at an own superset's membership, which both lock (Decision 13).
- [x] **Security** (the brief's item 6):
  - **The relay host guard applies to every caller.** `relayOf` (`nostr.js:240-253`) checks any `relay` given, with no caller test, and IN9 covers the owner, an admin, the direct-local caller and the command. The guard strips IPv6 brackets (`relayHostGuard.js:36`). It resolves the host and the socket then resolves it again, as everywhere the shared guard is used. A rebound address receives only a WebSocket upgrade and REQs.
  - **Signatures are still verified.** `_relay.js` gives nostr-tools a `verifyEvent` that accepts everything. It sets no verified mark, and events arrive parsed from JSON, so nostr-tools' cached-verification symbol can't be forged. `checkEvent` (`_letters.js:103-120`) recomputes the hash and checks the signature with nostr-tools' own `verifyEvent`. It runs on every path before anything is recorded: `readRefs` (`nostr.js:349`) for ids, addresses and graphs, and `finish` (`:508`) for filters.
  - **Only checked names reach the Cypher** (see ADR adherence).
  - **Bounds:** the refs and the filter's text are capped, but three things per call aren't (non-blocking 5).
  - **The TA pubkey** is resolved at run time, and nothing secret is printed.

## House rules check

- [x] Concept Graph API authority is respected.
- [x] No new lint, typecheck or build tooling. `test/helpers/cypherEngine.js` is a test fake, not tooling.

## Product-guide adherence

Not applicable: the story traces to no PRD, and it has no UI.

## Docs (the brief's item 7)

| Claim | Checked against | Holds |
|---|---|---|
| Catalog §5: no pipeline calls `import nostr`; a node holds its address or id and its author, not the relay | the diff (no caller); `_letters.js` `FIELDS` (no relay field) | yes |
| Catalog §5's row: the route, one relay, the guard, id and signature checks, NIP-01 keys, the claims; today's builders and their callers; the stream consumer takes kinds 3, 10000 and 1984 only | `nostr.js`, `_letters.js`; story facts 2–3 | yes. It lists three of `buildImportCypher`'s six callers, as the old row did |
| BIBLE §6: keys, the node, tags, claims, placeholders, own nodes | `_letters.js:122-171, 212-259, 331-340, 481-669` | yes, but for one line (non-blocking 6) |
| BIBLE §6 and §11's cross-references: §7, §11, §23, §25, §27, §30 | BIBLE headings | all resolve |
| BIBLE §11's row: caps, outcomes, access, the command | the declaration; IN13 | yes |
| `clients/cli/skill/SKILL.md:9`'s exception for imports | ADR Consequences; external-cli's SK3 (53/53 in the gate) | yes |
| Ledger `2026-11-20-todays-importers-keep-their-faults` | `eventSync.js:198, 200-202, 214-215, 248`; `normalize/index.js:139, 171`; `normalize/helpers.js:65, 97` | yes |
| Ledger `2026-11-20-scratch-stack-lacks-uniqueness-rules` | `run1-lv3-evidence.txt` (one constraint, `tags_address`; two nodes at one address and id); `live-suite.log`; the paths it names exist | yes |
| Ledger `2026-11-20-z-wiring-scans-every-tag-node` | `setup/neo4jConstraintsAndIndexes.sh:48` (only `nostrEventTag_uuid` covers `NostrEventTag`) | the scan, yes; "twice", no (non-blocking 7) |
| Ledger `2026-11-20-ci-gate-outgrows-its-timeout` (this story's duplicate `2026-11-20-stack-free-ci-outgrows-its-limit` was dropped at the staging merge) | `.github/workflows/test.yml:27` (15 minutes); the suites' times (about 36 s here) | yes, as far as checked: the run ids and their times weren't re-derived, since no GitHub call was made |

## Findings

### Blocking

1. **`src/operations/catalog/import/_relay.js:47` — a relay that drops the connection during a call kills the control panel.**
   - **The cause:**
     - `request()` subscribes without checking that the connection is still open.
     - In nostr-tools 2.10.4, `Subscription.fire()` calls `AbstractRelay.send()` without awaiting it (`node_modules/nostr-tools/lib/cjs/abstract-relay.js:453-454`).
     - `send` is `async` and throws `sending on closed connection` once a close has cleared `connectionPromise` (`:256-262, 360-362`). So the throw is an unhandled rejection, which the `try` at `_relay.js:46-57` can't catch.
     - Node 22 raises an unhandled rejection as an uncaught exception, and the control panel registers no handler. The only `uncaughtException` listener in `src/` is the realtime pipeline's, which runs as its own supervisor program.
   - **The failure:**
     - Any call that sends a request after the relay closed the connection ends the process: closed during a request, or between two.
     - Most calls send more than one request: every filter (pages and sweeps), every graph import, more than 100 ids, and addresses of more than one kind or pubkey.
     - So a relay can do this on demand to any instance whose agent names it, by dropping the connection after its first answer. So can strfry restarting during an import from the instance's own relay, or a network drop.
     - Supervisor restarts the panel (`autorestart=true`), but every request in flight fails, and the importing caller gets nginx's 502. The internal command `tapestry import nostr` dies the same way.
   - **Reproduced:** `tmp/review-32/run-crash.js` ran import nostr's own `run` on Node 22.23.1, with only the `connect` seam pointed at a loopback `ws` relay.
     - The run had three addresses of three kinds. The relay answered request 1's EOSE, then terminated during request 2.
     - The process exited 1 when request 3 was sent, with `Error: sending on closed connection` (`run-crash.out`). `relay-close.out` shows the same through `_relay.js` alone.
     - With an `unhandledRejection` listener added, the same run answered `not-found`, `unread`, `unread`, after request 3 had waited out its 10 s.
   - **Why the suites can't meet it:** the plan's relay seam replaces `connect` with `relayFake.js`, so nothing stack-free runs nostr-tools' `AbstractRelay`.
   - **Asked change:**
     - In `request()`, when `!relay.connected`, answer `{ ok: false, error: 'the relay closed the connection' }` without subscribing. The call's remaining refs then end `unread` at once, not after 10 s each. Reconnecting once would also do.
     - Add a stack-free case that drives `_relay.js`'s real `connect` against a loopback `ws` server that drops the connection during a request. It should assert that the call answers, with the rest `unread`, and that no `unhandledRejection` fires.

### Non-blocking

2. **`src/operations/catalog/import/_relay.js:74` and `:83` — a connect that times out leaves its socket open** (the brief's item 3: real, and small).
   - **The cause:** nostr-tools' connect timeout rejects without closing its WebSocket (`abstract-relay.js:230-235`). Neither `connect` nor `open` closes the relay when connecting fails or `within` gives up.
   - **What it does:** a handshake that finishes after 5 s leaves an open socket that nothing holds, while `open()` retries on a second one. In `relay-stray.out`, the first handshake finished at 6 s, after the call had connected on its retry and closed; it was still open 11 s later.
   - **Does it matter:** nothing reads that socket, and it lives until the remote closes it. strfry pings every 55 s (`setup/strfry.conf.template:82`), which keeps a live client's connection open. So in the long-running panel it is a slow leak: one socket for each slow-to-connect relay, two when both tries time out.
   - **Optional:**
     - in `connect`, catch the failed `relay.connect()`, call `relay.close()`, and rethrow;
     - in `open`, when `within` wins, close whatever the pending connect resolves later.

3. **The uniqueness rules: one node per event is a precondition no one is told of** (the brief's item 2).
   - **Where it stands:** ADR Context 3 and Decision 13 made `nostrEvent_id`, `nostrEvent_uuid` and `tapestry_key` the mechanism, and the code keeps to them. An instance set up through the UI has the rules, since Install Firmware waits for `expectedNeo4jSchema.js`'s list.
   - **What it misses:**
     - Nothing in the declaration or in BIBLE §6 says the import relies on them.
     - An instance whose firmware went in through the API, as the scratch stack's did (and as A10.37's seed-firmware might), has none. There, two imports of one event at once leave two nodes at one address (live run 1, `run1-lv3-evidence.txt`).
     - No operation repairs that yet, and every later lookup at that address then meets both (`_letters.js:493` takes the first). The same holds for two person nodes without `nostrUser_pubkey`. Sequential imports stay correct either way.
   - **The options; the choice is the owner's:**
     - **(a) Keep it a precondition, and say so** in the description and in BIBLE §6, and close the scratch-stack ledger row so live checks run on the real schema. Cheapest, but concurrent imports on an instance without the rules can still duplicate.
     - **(b) Check and refuse.** Before the first write, read `SHOW CONSTRAINTS` (cached once all are present), and refuse with a new 409 that names the missing rules, the Dashboard's fix and `lifecycle migrate --migration tapestry-keys`. That is one read a call at most, and the same wait Install Firmware keeps. A new refusal means an ADR amendment and a test.
     - **(c) Check and warn.** Record anyway, and name the missing rules in the answer. Duplicates stay possible.
     - **(d) Serialize in-process.** A lock for each key around `recordOne` makes the panel's own concurrent calls safe without the rules, but not the internal command running beside it.
   - **The reviewer's lean:** (b). A duplicate is local state no import should make (BIBLE §30), and the check costs one read. (a) is sound if every instance is known to be set up.

4. **`src/operations/reads.js:178` — a stranger's tag node counts from the owner's point of view.** This is pre-existing, and this story widens it (the brief's item 4).
   - **import nostr's own rules never take a tag node for an own node:**
     - its lookups leave tag nodes out (`AT_UUID`, `_letters.js:274-277`; `WITH_ID` names `NostrEvent`), and claim ends resolve through the same lookups;
     - a tag's reference starts at the claimant's own tag and is never judged;
     - `TAGS_DROP` runs only on a foreign node, since an own one returns at `_letters.js:497`, and it keeps a tag node another node also holds (`:313-317`).
   - **Where the misreading lives:**
     - `factsOf` (`catalog/graph/_nodes.js:98`, through `reads.js:215`) calls a node with no `pubkey` own.
     - C2's trust fragment (`reads.js:178`) counts any such node from every point of view.
     - So a stranger's `e` or `a` reference into an own node, which amendment 2 now makes on purpose, counts from the owner's point of view in `graph list-relationships` when it's asked for `REFERENCES`. The live check's `calls/07b-target-refs.out` shows the referrer's tag node with `author: null, own: true`.
   - **Optional:** no ledger or OPEN row names this; a ledger row would. The fix is to judge a tag node by the node that `HAS_TAG` it.

5. **Bounds that escape the caps** (the brief's items 5 and 6).
   - **Per event,** nothing grows past the event's own tags but the `z` wiring. Beyond its scan (the ledger row), each `IS_THE_CONCEPT_FOR` the import makes:
     - gives one `HAS_ELEMENT` to every node whose `z` names the header;
     - writes every one of their keys into that event's single change entry, in both `keys` and `changes` (`_letters.js:609`, `changes.js:123, 127`).
     
     That is bounded by the data, not the event.
   - **Per call,** three things escape the caps and the 40 s:
     - **`settle` records every event a graph's nodes found, with no time check** (`nostr.js:369-389`), and the 1,000-letter cap is checked only before a graph is followed (`:426`). One graph letter can list about 1,000 nodes within strfry's 128 KB websocket payload (`strfry.conf.template:76`). At LH2's 15 letters a second, that is about 65 s, past nginx's 60.
     - **`judge` sends one sweep for each kind,** and for a crowded kind one for each author, with no time check (`nostr.js:523-559`).
     - **A request keeps every event a relay sends before EOSE** (`_relay.js:48`). A relay that ignores `limit` fills memory and, on the filter path, the answer, since a second is finished whole (`nostr.js:506-514`).
   - **`filter` as an object has no size cap;** only its text has one (`nostr.js:87-89`), under the panel's 100 MB body limit (`bin/control-panel.js:124`).
   - **Reach:** each needs an admin's call, and LH2 met none.
   - **Optional:**
     - deadline checks in `settle`'s loop and in `judge`'s parts, leaving the rest `unread` or in `next`;
     - stop a request at the number of events it asked for;
     - cap the filter's serialized size, as its text is capped.

6. **`BIBLE.md:368` — the Placeholders bullet says the import "wires every node whose `z` names the header".** Deviation 4 leaves the instance's own nodes out (`_letters.js:377`). Optional: write "every node but the instance's own".

7. **`ledger/2026-11-20-z-wiring-scans-every-tag-node.md:13` — "runs the scan twice" is once.**
   - `WIRE` runs only for an `IS_THE_CONCEPT_FOR` the record has just made (`had` false, `_letters.js:596-599, 604-607`).
   - The core nodes graph's copy of the concept graph's `IS_THE_CONCEPT_FOR` (both list it: `importFixtures.js:131-132, 140`) finds it already there, and doesn't scan.
   - The `EXPLAIN` plans the Evidence cites aren't in `tmp/live-check-32/`; only `explain.sh` is.
   - Optional: correct the count, or show the second scan, and keep the plans' output beside the script.

8. **`engineering-team/stories/graph-operations-first-slice/32-import-nostr.md:201` — "The race, ten more times" overstates the race.**
   - In `race.log`, the first import finished in 11–38 ms, and runs 2–9 sent the second 25–400 ms after it. Those eight were repeats, not races.
   - Three trials overlapped: runs 0 and 1, and LV3. Run 1's two nodes show that LV3's pair did overlap.
   - Optional: say so in the Evidence.

9. **`src/operations/catalog/import/nostr.js:432-433` — a re-recorded graph letter's `failed` goes unreported.** When a graph letter read earlier as another graph's node is recorded again on being followed, only an `unchanged`→`updated` change reaches its entry. A `failed` second record, whose relationships that only then resolve weren't made, leaves the first outcome standing. This branch is untested (deviation 7). Optional: carry `failed` and its reason into the entry.

10. **`src/operations/catalog/import/_relay.js:14-16` — "Every event comes back as the relay sent it" is not quite so.** nostr-tools' `AbstractRelay` drops an event that doesn't match the request's filters, or whose shape makes `matchFilter` throw, before `onevent` (`abstract-relay.js:302`, swallowed at `:356`). Signatures are unaffected (see Security). Optional: reword the comment.

### Harness friction

None new. Two notes:
- The brief's path for `tapestry-key-paths` was wrong. The suite is under `test/operations/lifecycle/`, and the harness docs name it by file only.
- The scratch stack's missing rules already have the Implementer's `meta` row, `2026-11-20-scratch-stack-lacks-uniqueness-rules`.

## On PASS (same commit)

Not applicable: the story's status stays `Approved`, and completion detection waits for a round that passes.

## Verdict

**CHANGES_REQUESTED**

## Round 2 — 2026-11-20 (HEAD `42eaaeca`)

The owner chose to fix every round-1 finding before the pull request, tests first. Round 1 was committed as `542b64d6`. The round added seven commits after it, each kept to its role's files:
- `c2925e77`, the session's:
  - the owner's answer on non-blocking 3, as a note under ADR 0032 Decision 13;
  - non-blocking 7's and 8's corrections;
  - non-blocking 4's ledger row, `2026-11-20-strangers-tag-nodes-count-as-own`;
- `e90d94e1`, the Tester's: IL8, IL9, IN15, IF9, IF10, IG11, IG12 and CE12. With them came the relay fake's live relays, the graph fake's `slow` and `failWrite`'s `after`, and the seams the tests pin: `reader.CONNECT_MS`, `reader.REQUEST_MS` and the declaration's `BUDGET_MS`;
- `0c083d16`, the Implementer's fix, in `_relay.js` and `nostr.js` only;
- `763d9506`, `31899132` and `42eaaeca`, docs: BIBLE §6, Decision 13's note, and the story's Deviations and Evidence, the second live check among them;
- `88e321bf`, the Tester's: IL9's live server reads the handshake socket it holds.

**How it was made.**
- **The same limits as round 1.** No `npm test`, no docker, and no call to the local stack, GitHub or Loom.
- **The suites and the gate** ran on the shell's Node v24.18.0, as in round 1, after `. tmp/a10-32/env.sh`.
- **On Node 22.23.1,** CI's and the container's major version, two more checks ran:
  - IL8's and IL9's red-before-green, on a `git archive` copy of `42eaaeca` under the ignored `tmp/review-32-r2/`. It ran with round 1's `_relay.js` and `nostr.js` put back, then with HEAD's (`red-check.sh`);
  - round 1's three probes, against HEAD.
  
  The runners, the probes and every log are in that folder.
- **Fresh claims.** Each fix was checked against the code, the commands and the probes, not against the commit messages.
- **The worktree.** `git status` was clean after each step.
- **The independent check** before the commit (P13) wasn't applied.

### Gates (run by the reviewer at `42eaaeca`)

- [x] **The scoped gate:** `zsh tmp/a10-32/gate.sh a10-32-review-2`, on a clean tree. Its `npm run gate:status -- --label a10-32-review-2` line, with the path shortened:

  ```
  20261120T155739Z-22666-6673 [a10-32-review-2] started 2026-11-20T15:57:39.833Z on 42eaaeca — PASS, exit 0, 1359 passed, 0 failed, 12 skipped, 5/5 suites · …/tmp/gate-runs/20261120T155739Z-22666-6673.json
  ```

  By entry:
  - `operations` 1,258/0/10 (238 s);
  - `external-cli` 53/0/0 (12 s);
  - `openapi-coverage` 13/0/0 (2 s);
  - `admin-action-sweep` 9/0/0 (0.5 s);
  - `schema-save-finds-the-right-header` 26/0/2 (20 s).
  
  That's eight more than round 1: the seven new tests and CE12.
- [x] **Each suite of `test/operations/import/` alone** (`tmp/review-32-r2/suites.out`):
  - `nostr` 15, `nostr-record` 15, `nostr-order` 11, `nostr-own` 7, `nostr-graph` 12, `nostr-filter` 10;
  - `nostr-relay` 9, in 10 s, down from 23 s, since IL5 and IL6 now wait the 1.5 s their `REQUEST_MS` sets;
  - `nostr-agent-through-cli` 1, `nostr-live` 6 skipped, `cypher-engine` 12.
  
  None failed. That's 92 passed, as the Evidence says.
- [x] **`tapestry-key-paths` alone:** 20 passed, 0 failed.
- [x] **harness-lint:** clean, before this commit and with it.
- [x] **Red before green, on Node 22.23.1** (`red-check.out`):

  | `_relay.js` and `nostr.js` | IL1–IL7 | IL8 | IL9 |
  |---|---|---|---|
  | round 1's (`542b64d6`) | pass | **fails**: the child exited 1, `Error: sending on closed connection`, from `importRefs` | **fails**: the timed-out connection was still open after the call (`live-handshake`, `live-open`) |
  | HEAD's | pass | passes | passes |

- [x] **Round 1's probes against HEAD, on Node 22.23.1:**
  - `run-crash-head.out`: three addresses, with the connection dropped during request 2. `run` answers `not-found`, `unread`, `unread` at once, and the process exits 0 (exit 1 in round 1);
  - `relay-close-head.out`: a request on the closed connection answers `{ ok: false, error: 'the relay closed the connection' }` at once;
  - `relay-stray-head.out`: the handshake that finished late never opened, and the server held 0 open connections 12 s later (1 in round 1).

### Round-1 findings, re-checked

1. **Blocking 1: fixed.**
   - **What it does now:**
     - `request()` answers at once, without subscribing, when `relay.connected === false` (`_relay.js:35`);
     - `connect` replaces the instance's `send` with one whose rejection is caught and ends that relay's open requests (`:81-87`).
   - **The race.** In nostr-tools 2.10.4 the check alone closes the path.
     - `send` throws only when `connectionPromise` is unset.
     - Once connected, only the error and close handlers unset it, and they clear `_connected` with it (`abstract-relay.js:250-251, 258-259`).
     - The connect timeout unsets it before `_connected` was ever set (`:232`), and our `close()` clears `_connected` but leaves the promise (`:412-414`). `request()` runs only after `open()` resolved, so while `_connected` is true the promise is set.
     - The check, `subscribe`, `fire` and `send`'s own check run in one synchronous turn, so no close event can land between them.
     - A close that lands after the REQ is queued ends the request through `closeAllSubscriptions`, so `onclose` answers `ok: false`. `ws.send` on a closing socket throws in neither Node's WebSocket nor `ws`.
     
     So the wrap is defence in depth, as the Deviation says: it covers another version's timing, or another unawaited `send`. (`Subscription.close()` sends only while connected, `:464-465`.)
   - **The wrap itself is sound:**
     - it can't recurse: its `closeAllSubscriptions` runs on a later microtask, with the map already cleared, and `Subscription.close` marks itself closed in the same turn it sends;
     - it hides no rejection anyone awaits, since nothing in nostr-tools awaits `send`.
     
     Not adding a process-wide `unhandledRejection` handler was the right call.
   - **Tests and evidence:**
     - IL8: red on round 1's code, green now, on Node 22.
     - The second live check restarted strfry during an import from the own relay. The call answered 200 with 499 recorded and `next.until`, and the control panel kept pid 4349. Going on recorded the other 101 (`rerun/drop.json`, `drop-continue.json` in the main checkout's `tmp/live-check-32/`).
2. **Non-blocking 2: fixed.**
   - `connect` closes the relay when its connect fails (`_relay.js:92`). That is the path nostr-tools' timeout takes, since its timer is set before `within`'s and fires first.
   - `open` closes a connect that resolves after `within` gave up (`:109`).
   - IL9 is red then green, and my probe shows the late handshake never opens.
3. **Non-blocking 3: settled by the owner, as round 1's option (a).**
   - The rules are a precondition, never checked as the import runs (Decision 13's note, and BIBLE §6). Both name the five rules.
   - Both say Install Firmware waits for the first four, which are `expectedNeo4jSchema.js`'s, and that `tapestry_key` comes from the migration. G12 pins that install doesn't wait for it, and the ADR's note has said so since `31899132`.
4. **Non-blocking 4: recorded.** Ledger row `2026-11-20-strangers-tag-nodes-count-as-own` (`bug`) is accurate: its lines, the live check's `07b-target-refs.out`, and its fix shape.
5. **Non-blocking 5: fixed, with two residuals.**
   - **The time now holds** in four places, under IG11 and IF9:
     - in `readRefs` (`nostr.js:350`);
     - in `settle` (`:391-395`), where what isn't recorded in time answers `unread`;
     - after a graph's nodes (`:468`), with the graph also under `next.graphs`;
     - in `judge`'s parts (`:545`), with the second left to `next.until`.
   - **A request keeps at most its filter's `limit`** (`_relay.js:37`; IF10).
   - **A `filter` object's JSON is capped at 10,000 characters** (`nostr.js:223`; IN15).
   - **Residual (a), recorded in the Deviations:** requests for ids and addresses carry no `limit` (`nostr.js:321, 336`). So they keep what a relay sends before EOSE, and `readRefs` checks each matching event's signature in turn.
   - **Residual (b):** not recorded; it is round 2's finding 13.
6. **Non-blocking 6: fixed.** `BIBLE.md:368` now ends "but the instance's own".
7. **Non-blocking 7: fixed.** The ledger row says once. `explain.txt` holds both plans: two index seeks for `AT_UUID`, and a `NodeByLabelScan` of 7,685 tag nodes (2,436 of them `z`) for `WIRE`.
8. **Non-blocking 8: fixed.** The Evidence says only the two runs at 0 ms overlapped, and counts three overlapping trials.
9. **Non-blocking 9: fixed.** `nostr.js:445` carries `failed` and its reason into the entry. IG12 tests it, which the fake's new `failWrite.after` (CE12) makes reachable.
10. **Non-blocking 10: fixed.** `_relay.js`'s header now says what nostr-tools drops before `onevent`, and that a request keeps no more than its limit.

### Findings (round 2)

#### Blocking

None.

#### Non-blocking

11. **`engineering-team/stories/graph-operations-first-slice/32-import-nostr.md:168` — a stale sentence.** The Deviation's last sentence says ADR 0032's Decision 13 note "says Install Firmware waits for all five; it is left as the session that wrote it left it". `31899132` corrected that note since. Optional: drop the sentence.
12. **`test/helpers/relayFake.js:49` — a stale comment.** "Nothing here opens a socket or asks a real DNS server" no longer holds: a `live` entry starts a `ws` server on 127.0.0.1. Optional: say the live relays listen on loopback only.
13. **`src/operations/catalog/import/nostr.js:521-528` — a second is still recorded whole, whatever the time** (finding 5's residual b).
    - **What happens:** `judge`'s parts now stop at the budget. But once they're all read in time, `finish` records the whole second before it looks at the clock.
    - **Why it matters:** a split second holds up to 500 events for each part it was split into. So a bulk publisher's second (memo #129 saw 6,717 events in one) read by a filter of many kinds can take minutes, past the 40 s and nginx's 60 s.
    - **Whose rule it is:** Decision 5 says the call "always finishes the second it is in", so this is the ADR's rule, not a fault of the fix.
    - **Optional:** a ledger row; or stop inside a second and answer `next.until` at that second, since a repeat over what was recorded answers `unchanged`.

### Harness friction

None new.

### On PASS (same commit)

- [x] The story's `**Status:**` is flipped to `Done` in place, and its "Review:" link is filled in.
- [x] Completion detection was performed. Its result is in the chat, not in this file.

### Verdict (round 2)

**PASS**
- **The blocking finding** is fixed, tested red then green on Node 22, and shown live.
- **Each round-1 non-blocking finding** is fixed, recorded, or settled by the owner.
- **Three non-blocking findings are new:** a stale sentence in the story, a stale comment in a test helper, and the ADR's rule that a second is always finished whole, which can still outrun the budget.
- **For the owner to ratify:** nothing new. Decision 13's note records the owner's own answer.
