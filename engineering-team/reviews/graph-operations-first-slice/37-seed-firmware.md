# Review: Story 37 — `lifecycle seed-firmware`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-20 (the gate ran 2026-11-21 UTC)
**Diff:** `git diff 8fc07725...HEAD`, HEAD `d7572ebb` (staging merged in): 33 files, +5040 −43. The commits are `67146470` (Amendment 1), `abfcbda4` (the failing tests), `efffea8e` (status P3 re-aimed), `e18fc03d` (the implementation), `1a79e174` (L1 and the first-contact fixture re-aimed), `63ca7f95` (the docs, the live check, Amendment 2) and the merge `d7572ebb`.

**Against:**
- the story, [37-seed-firmware.md](../../stories/graph-operations-first-slice/37-seed-firmware.md): its ACs, its "Changed at" sections, its Deviations and its Evidence;
- [ADR 0037](../../decisions/graph-operations-first-slice/0037-seed-firmware.md): Decisions 1–13, Amendments 1 and 2;
- the binding [ADR 0043](../../decisions/graph-operations-first-slice/0043-firmware-ships-as-pinned-tapestry-releases.md): Decisions 1, 5 and 8;
- the [test plan](../../stories/graph-operations-first-slice/37-seed-firmware.test-plan.md);
- CLAUDE.md's four architecture invariants and its rule against hardcoding the TA pubkey;
- the live check's records in `tmp/live-check-37/`. I read them and ran nothing live.

**How it was made.** A reviewer agent with no Edit access wrote this review.
- Every run was stack-free, after `source tmp/a10-37/env.sh`. That puts stub `curl` (exit 7) and `docker` (exit 1) first on `PATH`, points every endpoint at a dead port, sets `TAPESTRY_CONTAINER=no-such-container`, unsets `TAPESTRY_CONTAINER_PORT`, and gives `BRAINSTORM_CONF_PATH` a dead conf.
- It never ran `npm test`, `docker`, anything against the local stack, the network, GitHub or Loom.
- Its four probes are throwaway scripts in the session's scratchpad. Each loads the real `buildTarget` and `_seed.js` over `firmware/active`, with a fake `read` and no graph. Three back the blocking findings, and their inputs and outputs are quoted there. The fourth found that the target has no self-loop on `superset`'s superset, and lists that superset under `set` rather than under `superset`. That is the order-dependent pair L1 shows, which Amendment 1, item 5 ratified.
- The independent check before the commit (workflow 5, P13) wasn't applied.

**Verdict:** CHANGES_REQUESTED: two blocking findings, eight non-blocking, two nits.

## Quality gates (run by reviewer, not trusted)

- [x] **The scoped gate.** `npm test` was not run: on this Mac it writes to the agent-memory instance.
  - It ran the 13 suites the session named, plus three registry suites that read files this diff changes:
    - `openapi-document`, which reads BIBLE §11;
    - `ledger-row-ids` and `session-start`, which read the real `ledger/`.
  - `npm run gate:status -- --label a10-37-review`: `20261121T015021Z-76154-164b [a10-37-review] started 2026-11-21T01:50:21.519Z on d7572ebb+dirty — PASS, exit 0, 1628 passed, 0 failed, 45 skipped, 16/16 suites`. The record is `tmp/gate-runs/20261121T015021Z-76154-164b.json`. "dirty" is the untracked `node_modules` symlink, the only entry in `git status`.
  - `operations` passed 1390 with 14 skipped, in 293.7 s. In this branch's gate records it took 251–257 s at Test Design, when the new suites failed fast, and 289–294 s since the implementation.
- [x] **Each new suite alone**, with the same environment:

  | Suite | Pass | Fail | Skip | Time |
  |---|---|---|---|---|
  | oracles | 8 | 0 | 0 | 0.1 s |
  | target | 31 | 0 | 0 | 1.3 s |
  | plan | 8 | 0 | 0 | 0.6 s |
  | route (`seed-firmware.test.js`) | 32 | 0 | 0 | 16.2 s |
  | record | 4 | 0 | 0 | 0.3 s |
  | agent | 1 | 0 | 0 | 5.5 s |
  | live | 0 | 0 | 4 | 0.1 s |
  | status | 9 | 0 | 0 | 0.5 s |

  That is about 25 s in all. CI's stack-free job has `timeout-minutes: 25` (`.github/workflows/test.yml:27`). I couldn't see CI's recent run times.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`.
- [ ] `npm run test:playwright`: not applicable. The diff changes no UI.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] **Every acceptance criterion has a passing test:**
  - AC1: ST1–ST17, SF3–SF6, SP1;
  - AC2: ST19, SF7–SF9, SR1–SR4, status P3;
  - AC3: SF10, SF11;
  - AC4: SF14–SF18, SF21–SF23, SP3–SP5, SP8;
  - AC5: SF19, SP6, ST28;
  - AC6: SF12, SF13, SF20;
  - AC7: SF1, SF2, SF24–SF32, ST21–ST27, ST31, SA1, and L1–L4 live.
- [x] **No criterion is dropped.** Two paths make the code miss AC2, AC3 and AC4 on an instance where they occur, and no test covers either (blocking 1 and 2).
- [x] **No behaviour beyond the story.** The answer's extra fields (`heldBy`, `fromSource`, `references`) are Deviations, and they are small.

## ADR adherence
- [x] **The files** are the ones the Implementation notes list:
  - new: `target.js`, `_seed.js`, `seed-firmware.js`;
  - changed: `firmware.js`, `_concepts.js`, `_elements.js`, `_common.js`, `status.js`, `tapestry-derive.js`, both derivers, `_schemas.js` (story 42's judge), and the docs.
- [x] **The layering** is a source (`src/firmware/target.js`, pure: it reads files and nothing else) and an installer (`_seed.js`), behind one catalog declaration.
- [x] **No new dependencies.**
- [ ] **The Deviations.** Two are larger than a Deviation line should carry: N2 and N3.
  - Deviation 12, walks rather than Neo4j's no-edge-twice paths, stays within what Amendment 1, item 5 ratified, as far as the live L1 shows.

## Concept-graph integrity
- [x] **Handles** are `39998:<TA>:<slug>`.
  - The TA pubkey is resolved at runtime: `K.assistant()` → `getOwnerAssistantPubkey()` in `seed-firmware.js:126`, and `getOwnerAssistantPubkey()` in `status.js:193`.
  - `buildTarget` refuses a `ta` that isn't 64 hex.
  - No pubkey literal appears in the added source: I grepped it for 64-hex strings and for `82b75e47`.
- [x] **Firmware reinstall:** none needed. No file under `firmware/` changes.
- [x] **Orientation via `/summaries`:** not applicable. The new code reads no concept definitions at runtime beyond the firmware files it installs.

## Things tests can't catch
- [x] **No secrets, no debug logging, no commented-out code, no TODOs** in the added source (grepped).
- [x] **Nothing signs or publishes.**
  - The three new files require no signer, relay or key store. `normalize/helpers.js`, which `apply` requires for `randomDTag`, loads `nostr-tools` and the key only when they're called.
  - SF6's spy is empty.
  - Live, the agent's install answered `letterOutOfDate: 0` and "Nothing was signed or sent to any relay".
- [x] **The transaction.**
  - One `executeWrite`. A retry recomputes the state and the plan, and nothing is written outside `tx`.
  - `not-firmware` is thrown inside it, so it rolls back.
  - The lifecycle lock is released in `finally`.
  - The cache step and rules check run after the commit. A failed derive is counted; a failed rules check is caught and answers `problem`.
  - Live: 29 s through nginx, `cacheOutOfDate` 0, and rules check judged 41 concepts.
- [x] **The Cypher.**
  - Every address lookup names `NostrEvent|TapestryNode`.
  - The b claim's placeholder `MERGE` carries `keyNode`, and `makeNode` carries it through `_eventless`.
  - Relationship types pass `quoted()` in `apply`, and labels come only from `LABELS`.
  - `tapestry-key-paths` passes 20 of 20.
  - One gap is N1.
- [x] **The b claim's placeholder** (Deviation 2) is taken over by the import, as claimed. `buildImportCypher` runs `MATCH (x:TapestryNode {uuid}) WHERE NOT x:NostrEvent SET x:NostrEvent` before its `MERGE` (`src/api/neo4j/eventSync.js`), and `placeholderUnlessHeld` makes no second node.
- [x] **`rewrite`** deletes a node's tag nodes and makes new ones. `importEventDirect` does the same (`DELETE r, t`, then `CREATE`) and hangs nothing on a tag node, so nothing else is lost.
- [ ] **Concurrency.** Two seed-firmware calls install once (SF11). Today's install isn't covered by either lock: N5.
- [ ] **Local-first (principle 4):** blocking 2, and N4.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence
Not applicable. The story traces to no PRD.

## Findings

### Blocking

1. **`src/operations/catalog/lifecycle/_seed.js:181` and `:694`: an offloaded installed-firmware graph reads as no install at all.**
   - **The cause.** `readState` and `seeded()` read the installed-firmware graph's `json` tag with `JSON.parse` only. Yet `jsonValueOf` (`:69-80`) resolves an `lmdb:` reference for every firmware node.
   - **How it happens.** The owner's "Offload N tags" button on the Dashboard (`ui/src/pages/Dashboard.jsx:559-575`, `POST /api/tapestry-key/offload-all`) turns every inline `json` tag into `lmdb:<tapestryKey>`. It is offered whenever inline tags exist, which is always after a seed-firmware run: every node it writes has one.
   - **Probe.** The real `readState`, `seeded()` and `plan` over `firmware/active`, the installed-firmware graph's `json` tag given first inline, then as `lmdb:<key>`:
     - inline: `{"installedFound":true,"last":"read","seeded":"read","writes":true}`;
     - offloaded: `{"installedFound":true,"last":null,"seeded":null,"writes":true}`.
   - **What follows:**
     - status says "Nothing has been installed by lifecycle seed-firmware yet" (AC2);
     - the next run is treated as first contact, so a run that changes nothing still records a change entry (AC3);
     - a relationship the firmware no longer makes isn't taken out, and from then on counts as `others` (AC4);
     - a new firmware relationship between two existing nodes is `kept` with `noRecord`, then listed, and so `kept` on every later run (AC4);
     - a node the firmware dropped is never reported `not-in-source`.
   - **The same button, a second effect:** `_seed.js:69-80` with `src/lib/derivers/set.js:114`.
     - An offloaded node's `json` is read from its LMDB entry, which the derive overwrites.
     - The set deriver writes a Superset's `word.wordTypes` as `["word","superset","set"]`. All 41 firmware supersets carry `["word","set","superset"]`, and `stable()` keeps array order.
     - Probe: node-type's superset against its own JSON as the set deriver leaves it gives `same json part: false`, and differing parts `["json"]`.
     - So once the supersets are offloaded and derived again (Dashboard "Derive all", `cache rebuild`, or seed-firmware's own adoption), every one of them reads as edited. It is `kept` (or not adopted on first contact), a firmware change to it never lands without `take`, and `changedSince` counts it.
   - **Asked change:**
     - read the installed-firmware graph's `json` through the same `lmdb:`-resolving reader, in both places;
     - make an offloaded node's content compare correctly against what the derive leaves. That is the Architect's call, for example comparing as the deriver normalizes, and it amends Decision 6 if the content rule changes;
     - add a test that offloads the `json` tags (the installed-firmware graph's and a superset's), derives, then runs status and a repeat. It should find `seeded` not null, 459 `unchanged`, and no change entry.

2. **`src/operations/catalog/lifecycle/_seed.js:155` and `:598-600`: an admin's own element at the installed-firmware graph's address is taken for seed-firmware's, and overwritten.**
   - **The cause.**
     - seed-firmware recognises its installed-firmware graph by address alone.
     - That address is where `graph create-element --concept graph --name "installed firmware"` puts an admin's element: `freeAddress`'s first candidate is `childDTag(name, header)` (`src/operations/catalog/graph/_elements.js:362`). Every instance can still have one, since none has run seed-firmware.
     - The graph concept's schema requires `graph.nodes` and `graph.relationships`, so such an element is read as the last install's lists.
   - **What follows.** seed-firmware takes out each relationship listed there, between firmware nodes, that the firmware doesn't make. Then `rewrite` deletes the element's tag nodes and replaces its name, tags and JSON.
   - **Probe.**
     - The input: an admin's graph element at that address, listing `dog-primary-property IS_A_PROPERTY_OF nostr-relay-schema`. That is the instance's own second-parent link, which SF17 shows surviving an update.
     - The output: `read as the installed-firmware graph: true | its lists read as the last install: true | writes: true` and `relationships the plan takes out: ["dog-primary-property IS_A_PROPERTY_OF nostr-relay-schema"]`.
   - **Why it blocks.** A firmware install destroys locally-authored graph state, which CLAUDE.md's principle 4 and BIBLE §30 forbid. Firmware nodes have the safe rule, kept with `noRecord` when they differ. This node doesn't.
   - **Asked change:**
     - treat a node at that address as the installed-firmware graph only when it carries seed-firmware's mark: an `installedFirmware` section, or a record seed-firmware sets on it;
     - otherwise change nothing and refuse, naming the node. That is a new refusal, so it amends Decisions 1 and 9;
     - add a test with such an element in place before the first run: refused, and the graph untouched.

### Non-blocking

1. **N1 — `_seed.js:238-239`: aliases from firmware files go into Cypher unchecked.** The blocked-element query puts `R.INIT`, `R.PROP` and `R.TERM` into its text without the `quoted()` check `apply` uses (`:438`). `_concepts.js:475` does the same with the module's aliases, and the files are trusted today. Once a release fetched from relays is the source, it is an injection path. Use `quoted()` here, or have `readFirmware` refuse an alias that isn't a plain name as `firmware-unreadable`.
2. **N2 — Deviation 5 (story `:209`) widens which relationships Decision 8 takes out.**
   - Decision 8 takes out a relationship "the last install listed". Deviation 5 lists every target relationship, kept ones included, though Decision 9 lists what was "made, brought in line or adopted".
   - So a relationship kept on first contact, whether made by today's install or with properties an admin edited, is taken out when a later firmware drops it, though no seed-firmware install made it.
   - That changes a deletion rule: it should be an amendment the owner ratifies, or the listing should keep kept relationships apart.
3. **N3 — Deviation 7 (story `:211`) conflicts with ADR 0043.** ADR 0043's Decision 1 says "An update moves the record to the newer release's letter". Under Deviation 7, an unchanged node keeps an older `installed.version` and `source`, and a `cameFrom.id` that can name an older file's sha256. That works for files. The Deviation should name the conflict, so the release story, where every member is a new letter, revisits it.
4. **N4 — `src/lib/derivers/word.js:126-130`, `set.js:186-190`, `_schemas.js:219-224, 259`: `cameFrom` and `installed` can clash with a concept's section.**
   - Both names share the top level of word-wrapper JSON with concept keys.
   - For any node without the property, the derive deletes a top-level `installed` or `cameFrom` section. For an offloaded node, its LMDB entry is the only copy, so the section is lost. The judge never checks either section, on writes too.
   - Only a concept whose key is `installed` or `cameFrom` meets this.
   - Replace a section only when the node carries the property, or the section has the record's shape. Or use names no concept key can take.
5. **N5 — `seed-firmware.js:142`: neither lock covers today's install.**
   - The lifecycle lock and the concept lock leave out today's install, which has neither lock nor running flag. It still runs from the Dashboard and at first start.
   - Run together, `makeNode`'s `CREATE` (`_eventless.js:65`) and the import's `NostrEvent`-only `MERGE` can leave two nodes at one address.
   - Refuse `busy` while today's install runs, or say so in BIBLE §7.
6. **N6 — `BIBLE.md:427`: three changes to the docs.**
   - Say that an instance seed-firmware alone installed reads as not installed to `GET /api/firmware/install-status`, which counts `NostrEvent` headers (`src/api/firmware/index.js:128-160`). So with `TAPESTRY_FIRMWARE_ON_BOOT` set, `tools/firmware-on-boot.sh` runs today's signing install over it at the next start, and that undoes edits made in between.
   - "The five schemas pass 3b fills" is four in v1.0.0 (Amendment 2).
   - `BIBLE.md:8`'s **Last updated** names neither the §7 change nor the §11 one. L9 allows 14 days.
7. **N7 — ADR 0037 `:277` (Consequences) claims more pinning than exists.**
   - It says "a change to today's install fails a test until the builder follows". That holds for the routes in `index.js`, which the oracle runs from source.
   - It doesn't hold for `install.js`'s walk or its edge passes (1c¾, 1d, 1d½, 1d¾, 1e, 3c). `target.js` rewrites them, and they are pinned only by ST11–ST16's expectations and one live L1. SF30 checks only `install.js`'s exports.
   - Add a tripwire on the passes' bodies, or correct the sentence.
8. **N8 — Two Evidence lines don't match their records.**
   - Story `:228`: the gate record reads `on abfcbda4+dirty`. It ran before `e18fc03d` was committed, and before `1a79e174`'s re-aims.
   - Story `:256`: the lookup's record, at `agent-run.log`'s "the agent looks up a firmware concept", prints only `[]`. "Found the concept at `39998:<the scratch's assistant>:dog`" isn't in the records. SA1 covers the lookup stack-free.
   - Correct both lines.

### Nits
1. `seed-firmware.js:54`: the note ends "but what was kept." even when nothing was kept.
2. Two stale lines about who and what:
   - `_common.js:63`: BUSY's `when`, which `/docs` and the listing show, still names only backup, restore and migration, though seed-firmware takes the same lock;
   - catalog `docs/GRAPH_OPERATIONS_CATALOG.md:202`'s "Who may call: the owner only." now sits above a row that says owner and admins.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. Nothing maps a diff's files to the registry suites that read them. The gate the session gave named 13 suites. Three more read files this diff changes: `openapi-document` reads BIBLE §11, and `ledger-row-ids` and `session-start` read the real ledger. I found them by grep. The Implementer's gate (12 suites) missed them too.

## What I could not check
- CI's run time against its 25 minutes. The full `npm test` (forbidden here).
- The live check, which I didn't run again. I read its records.
- That the dirty tree behind the Implementer's gate record equals `e18fc03d`. My own gate ran on `d7572ebb`.
- Neo4j's own behaviour for one transaction this size. L2 and the agent's run show it once, on a scratch stack.

## Verdict
**CHANGES_REQUESTED**

The story's `**Status:**` stays `Approved`. Completion detection doesn't apply.
