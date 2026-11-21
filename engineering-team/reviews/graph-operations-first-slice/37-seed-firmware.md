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

---

## Round 2

**Date:** 2026-11-20 (the gate ran 2026-11-21 UTC)
**Diff:** `git diff a314ec60 HEAD`, HEAD `c6602d62`: 23 files, +841 −157. The commits:
- `d2c7a6c8`: ADR 0037 Amendment 3, with ledger rows `2026-11-21-todays-install-races-seed-firmware` and `2026-11-21-no-map-from-diff-to-suites`;
- `f8921b63`: the Tester's failing tests for round 1's findings;
- `d90418c4`: the fixes. Besides Amendment 3's files, they change `src/operations/rules/element-fits-schema.js` and `src/lib/derivers/schema-verdicts.js`, and log seven new Deviations;
- `c6602d62`: the Evidence, with the live re-check.

**Against:** Amendment 3's nine items, round 1's findings and nits, the seven new Deviations, and the live re-check's records `tmp/live-check-37/r2-*`. I read those records and ran nothing live.

**How it was made.**
- As in round 1: stack-free after `source tmp/a10-37/env.sh`, with no `npm test`, no Docker, no network.
- One more scratchpad probe ran the fixed `readState`, `plan` and `seeded()` with a fake `read`, over three cases:
  - a marked installed-firmware graph, inline: `held: false`, last install read, `seeded` read;
  - the same graph with an `lmdb:` reference that has no store entry: `held: true`, refused `address-held`;
  - an unmarked node at the reserved address: `held: true`, refused `address-held`.

**Verdict:** PASS. Every round-1 finding is resolved. Round 2 adds no blocking finding, four non-blocking ones and three nits.

### Quality gates (run by reviewer, not trusted)
- [x] **The scoped gate,** the 17 entries asked: round 1's 16 and `graph-rules-builder`. `npm test` was not run, since it writes to this Mac's agent-memory instance.
  - `npm run gate:status -- --label a10-37-review-r2`: `20261121T035540Z-66580-8461 [a10-37-review-r2] started 2026-11-21T03:55:40.061Z on c6602d62+dirty — PASS, exit 0, 1665 passed, 0 failed, 45 skipped, 17/17 suites`. "dirty" is the untracked `node_modules` symlink, the only entry in `git status`.
  - The record is `tmp/gate-runs/20261121T035540Z-66580-8461.json`. The story's suites inside it: oracles 8, target 33, plan 9, route 38, record 6, agent 1, live 0 with 4 skipped, status 9, key paths 20. `operations` passed 1401 with 14 skipped, in 289.4 s, as long as in round 1.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`.
- [ ] `npm run test:playwright`: not applicable.

### Round 1's findings, one by one

| Round 1 | Amendment 3 | The fix | Tested by | Now |
|---|---|---|---|---|
| Blocking 1, the offloaded record | items 1, 2 | Both readers go through `installedGraphOf`, which reads `json` with `jsonValueOf` and resolves `lmdb:`. `jsonValueOf` compares `word.wordTypes` sorted, without repeats. | SF33 (the real `offload-all` handler and the real derive in a child, over a real LMDB store), SP9; live: 416 tags offloaded, derive-all, then 459 `unchanged`, no change entry, `seeded` still read | Resolved |
| Blocking 2, the admin's element | item 3 | The graph moved to `39999:<ta>:installed-firmware`. It counts as seed-firmware's only with its mark: an `installed` record set on every write, and its `installedFirmware` section. Anything else there makes `plan` refuse `address-held`, inside the transaction, before any write. | SF34 (the admin's element and the second-parent link it lists stay as they were), SF35 (three unmarked variants refused, nothing written), SF8, SF11, SF13 | Resolved |
| N1, aliases in Cypher | item 5 | `readFirmware` refuses an alias that isn't `[A-Z_][A-Z0-9_]*`, so `readState`'s interpolation (now `_seed.js:257-258`) gets plain names only. | ST32, SF38 | Resolved |
| N2, kept relationships listed | item 4 | Kept relationships go in `installedFirmware.keptRelationships`. Only `graph.relationships` feeds the removal, and a kept one the firmware drops stays, reported `kept`. | SF36, SF37 | Resolved |
| N3, ADR 0043's record | item 9 | Deviation 7 now names the conflict, and what the release story does. | none needed | Resolved |
| N4, a concept's own `installed` / `cameFrom` | item 6 | The derivers add a section only from the node's own property and pass the names to the verdicts. The judge sets aside only what `record` names. The rule passes `recordCarried`. | SR4–SR6 | Resolved, with R2-N1 and R2-N2 below |
| N5, the race with today's install | item 7 | BIBLE §7 says not to run the two at once, and a ledger row records the race. The owner chose this over a lock. | none needed | Resolved as the owner chose |
| N6, the docs | none | BIBLE §7 notes the boot install, says "four on firmware 1.0.0" and gives the address; Last updated is 2026-11-21. | SF31 | Resolved |
| N7, the oracle's reach | item 8 | ST33 digests `pass1_bootstrap`, `pass2_enrich`, `pass_communityReferences` and `install`'s pass 3 (`install.js` at `b2948904`, its last change), and the Consequences say what pins each part. | ST33 | Resolved, with R2-N3 below |
| N8, the Evidence | none | The lines are corrected. `r2-resolve-dog.json` holds the lookup: one candidate, the instance's own `dog`. | none needed | Resolved, with nit 3 below |
| Nit 1, the note | none | The note now reads "Nothing changed: the graph already holds firmware 1.0.0 as its files say." (live) | none needed | Resolved |
| Nit 2, the stale access lines | none | BUSY's `when` names seed-firmware, and catalog §8's line now says the owner and admins. | none needed | Resolved, with nit 2 below |
| Harness friction | none | Ledger row `2026-11-21-no-map-from-diff-to-suites` | none needed | Recorded |

### The seven new Deviations
All seven are small enough to be Deviations. Each records a choice Amendment 3 left to the Implementer.

1. **The rule tells the judge** (`element-fits-schema.js:32-34, 85-87`).
   - This stays within item 6's intent. Item 6 says the judge sets the record aside "only when the node carries them". The rule is one of the judge's two callers that judge a node's tapestryJSON. Without this change, the rule and the derive would disagree on a recorded node under a closed schema (ADR 0042's one verdict).
   - The query adds two properties, and the call passes them on. Nothing else in the rule changes.
   - It is untested: R2-N2.
2. **The installed-firmware graph's own `installed` record has a node's shape.** Small.
3. **`address-held` is refused by the plan,** and status reads a held node as no install. Small, and checked by probe.
4. **`noRecord` on a relationship means `graph.relationships` doesn't list it.** This changes only what the answer reports.
5. **A kept-apart relationship stays listed while it is there.** This follows item 4.
6. **`word.wordTypes` is compared sorted, without repeats.**
   - Repeats count as set semantics, which item 2 implies.
   - It says plainly that records written before it read as edited. Only scratch stacks hold such records.
   - *Optional:* a later change to `contentOf` would do the same to real instances' records, and an `installed.scheme` field would let a reader tell.
7. **The catalog's group line.** The change is fine, but its wording overreaches: nit 2.

### Round 2's findings

#### Blocking
None.

#### Non-blocking
1. **R2-N1 — `_schemas.js:293` (`fits`) and `checkElements`: the write-path checks pass no `record`.**
   - Callers: `add-to-concept.js:127, 207`, `update-node.js:262, 297` and `create-element`/`create-set`.
   - Item 6's set-aside therefore doesn't hold there, though the node carries the record.
   - **Where it shows:** `graph add-to-concept` accepts a firmware element seed-firmware wrote. When that element's `json` tag is offloaded, `M.jsonOf` → `F.readJson` resolves the LMDB copy, record sections included, and the write's check judges them.
   - **Today it is harmless:** no firmware schema, and no schema builder, closes the top level (`additionalProperties`).
   - **Ask:** pass the node's `recordCarried` on these paths, or note the limit.
2. **R2-N2 — `recordCarried` (`_schemas.js`), the rule's only use of it (`element-fits-schema.js:85`), has no test.**
   - SR4–SR6 exercise the derive's path, which passes the names it added itself.
   - **Ask:** add a rule-level case: a recorded node under a closed schema fits, and a concept's own `installed` section in a node with no record is judged.
3. **R2-N3 — ST33 covers `install.js`, but pass 3c's logic isn't pinned.**
   - That logic is in `handleWireImplicitElements` (`src/api/normalize/index.js:5844`). The oracle doesn't run it and the tripwire doesn't digest it, yet `target.js` rewrites it.
   - The amended Consequences (ADR `:277-280`) say `index.js`'s routes are pinned by the oracle.
   - **Ask:** add that function's body to ST33, or say so in the Consequences.
4. **R2-N4 — ADR 0037's decisions still say what Amendment 3 changed.**
   - Decision 9 still gives the old address (`:225`). Decision 6 still sets the sections aside unconditionally (`:196`). Decision 3's refusal list lacks the alias rule (`:135`).
   - Amendments 1 and 2 corrected their decisions in place. Amendment 3 only adds its section.
   - **Ask:** correct them in place, or mark each with "see Amendment 3", when it is ratified.

#### Nits
1. **`_seed.js` `installedGraphOf` and `plan`: a marked graph whose offloaded `json` has no store entry is misreported.** The probe shows it refused `address-held`, in words saying it "isn't seed-firmware's record". It is safe. When the `installed` record is there, say instead that its JSON can't be read (an LMDB reference with no entry).
2. **`docs/GRAPH_OPERATIONS_CATALOG.md:55`, "Lifecycle (6, the owner and admins)", covers `wipe`.** `wipe` isn't built, and its access isn't decided. §8's line (`:202`) is scoped to the operations "built so far"; say the same at `:55`.
3. **The story's round-2 gate line says "on `d90418c4`, a clean tree".** The record reads `d90418c4+dirty`. The untracked `node_modules` symlink alone marks every run here dirty, mine too, so say that.

#### Checked and holding
- **Nothing written on `address-held`** (SF35, and the probe).
- **The old address is an ordinary graph element now.** An admin's element there keeps its name beside seed-firmware's own graph. The rulebook says "no rule makes them unique".
- **The reserved d-tag can still be given by today's `POST /api/normalize/create-set`,** whose explicit `dTag` (`index.js:4347, 4380`) puts a set anywhere. The mark then refuses `address-held`, so the mark is the protection that holds.
- **Item 4, traced in `plan` and `listingOf`.**
  - Only `graph.relationships` feeds `removed`.
  - Kept ones go to their own list, b claims included, and are never removed.
  - `others` excludes both lists.
  - A made relationship whose properties an admin edited is still taken out when the firmware drops it in the same run. That is what AC4 says.
- **The docs.**
  - BIBLE §7 matches the code: the address, the kept list, the boot install and the race.
  - BIBLE's Last updated names §7 and §11.
  - Catalog §8's line is fixed.
- **The live records back the Evidence:** `r2-agent.log`, `r2-offload.json`, `r2-repeat-after-offload.json`, `r2-status-after.json`, `r2-resolve-dog.json` and `r2-live-suite.log`.

### What I could not check
- CI's time against its 25 minutes, and the full `npm test`.
- The live re-check, which I read and didn't run.

### Verdict
**PASS**

### On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed. Its result is in the chat, not here.

---

## Round 3

**Date:** 2026-11-20 (the gate ran 2026-11-21 UTC)
**Diff:** `git diff a9f9625d HEAD`, HEAD `6b2b2200`, with nothing tracked uncommitted: 13 files, +322 −51. The commits:
- `5bc55fbd`: the docs: R2-N4's ADR text, nit 2's catalog lines and nit 3's Evidence wording;
- `b53f9629`: the Tester's tests: SR7–SR9, ST33's extension, and SF39;
- `6b2b2200`: the fixes, which include a change to the shared `src/operations/catalog/graph/_nodes.js`, and three new Deviation lines.

**How it was made.** As in rounds 1 and 2: stack-free after `source tmp/a10-37/env.sh`, with no `npm test`, no Docker and no network.

**Verdict:** PASS. Round 2's four findings and three nits are resolved, and nothing new blocks.

### Quality gates (run by reviewer, not trusted)
- [x] **The scoped gate: the 17 entries, and one more.**
  - The extra is `concepts-list-shows-concepts-with-no-event`. It is the one registry suite outside `operations.test.js` whose tests make nodes through the graph writes (create-concept, create-element). It does that only on a scratch stack, and skips it here.
  - `npm run gate:status -- --label a10-37-review-r3`: `20261121T044550Z-29841-3c49 [a10-37-review-r3] started 2026-11-21T04:45:50.061Z on 6b2b2200+dirty — PASS, exit 0, 1679 passed, 0 failed, 50 skipped, 18/18 suites`. "dirty" is the untracked `node_modules` link, the only entry in `git status`.
  - The record is `tmp/gate-runs/20261121T044550Z-29841-3c49.json`. Inside it:
    - the graph writes that read `factsOf`: add-to-concept 60, delete-node 40, move-element 44, remove-from-concept 36, update-node 46, update-node's shared helpers 13;
    - import nostr's suites, and the rules `element-fits-schema` 11 and `enumerated-value-allowed` 17;
    - this story's: route 39, record 9, target 33, plan 9, oracles 8, agent 1, live 4 skipped;
    - `operations` as a whole passed 1405 with 14 skipped, in 300.8 s.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`.
- [ ] `npm test` was not run: it writes to this Mac's agent-memory instance. `npm run test:playwright` is not applicable.

### Round 2's findings, one by one

| Round 2 | The fix | Tested by | Now |
|---|---|---|---|
| R2-N1, the write path's checks | `factsOf` (`_nodes.js:93-104`) carries `record`, `recordCarried` of the node `whoseNode` already reads whole, so no query changes. `fits` takes `{ record }`. graph add-to-concept (`:127`, `:207`) and update-node (`:262`, `:295`) pass `facts.record`, and the rule's write form hands `item.record` to the judge. create-element and create-set make new nodes, which carry none. | SR7: add-to-concept with offloaded and inline JSON, update-node on the installed-firmware graph, both under schemas closed at their top level; a node with no record still judged whole and refused | Resolved |
| R2-N2, `recordCarried` untested | Tests only | SR8 (13 shapes of properties); SR9 (the rule's node form: a recorded node fits, one without a record is judged whole) | Resolved |
| R2-N3, pass 3c unpinned | ST33 digests `handleWireImplicitElements` too, failing with a message that names `src/firmware/target.js` | ST33 | Resolved |
| R2-N4, the ADR's decisions | Corrected in place: Decision 1's refusals gain `address-held`; Decision 3 gains the alias rule; Decision 6 reads `wordTypes` as a set and adds the record only when it is carried; Decision 9 has the reserved address, the mark and the kept list | None needed | Resolved |
| Nit 1, an unreadable record's words | `installedGraphOf` tells a recorded graph whose JSON can't be read apart, and `plan` refuses `address-held` in words that say so: a missing tag, JSON that isn't an object, an LMDB entry that is missing or isn't an object | SF39 | Resolved |
| Nit 2, the catalog's `wipe` | Catalog `:55` and `:202` scope "the owner and admins" to the operations built, and say that wipe's access isn't decided | None needed | Resolved |
| Nit 3, the Evidence's "clean tree" | It now says `+dirty` only for the untracked `node_modules` link | None needed | Resolved |

### The `_nodes.js` change and the other graph writes
- **Who uses `factsOf`:**
  - `whoseNode` (U0) and its callers: `_memberships.js:186` (add-to-concept and remove-from-concept), `move-element.js:204`, `remove-property.js:33` and the rule `node-has-a-concept.js:55`;
  - `_properties.js:538, 665`;
  - `delete-node.js:173`, and `:310`, which rebuilds facts from a deletion's entry;
  - import nostr's `_letters.js:414`.
- **None of them copies the facts whole.** Each reads named fields (`own`, `labels`, `uuid`, `hasLetter`). The answers' node objects pick theirs explicitly: `nodeOf` (`_memberships.js:170`) and `answerNode` (`delete-node.js:100`). So the new `record` reaches no answer, change entry or result schema.
- **The new `require('./_schemas')` inside `factsOf` loads nothing.** `_schemas.js` has no require at module scope, and doesn't require `_nodes.js`.
- **The gate runs every affected suite and passes.** `operations` runs every graph write's suite, import nostr's and the rules'; `external-cli` runs the agents'.

### The three new Deviation lines
All three are small.
1. **A node's record rides on its facts.** This is the mechanism R2-N1 asked for, and it changes no query.
2. **Writes keep an offloaded node's record sections in its `json` tag.**
   - This records a consequence of the store's shared entry. A write reads an offloaded node's JSON from the derive's copy and writes it back inline, as `graphContext` already rode before this story.
   - Every place that judges or compares a recorded node sets the sections aside.
   - Of seed-firmware's nodes, only the installed-firmware graph has an offloadable `json` tag that such a write keeps in place. update-node refuses the others. add-to-concept refuses core nodes and sets (`made-elsewhere`) and keeps a firmware element's section beside its letter (`keptIn`, `_memberships.js`). A relationship letter has no `json` tag to offload.
3. **The unreadable case reaches past nit 1's.** It covers every way the JSON can't be read, and status still reads such a node as no install.

### Round 3's findings
- **Blocking:** none.
- **Non-blocking:** none.
- **One observation, no change asked.** The property operations' report (`_properties.js:1062-1064`, `validatorOf().check`) judges an element's tapestryJSON whole, the record included. It never refuses, and it could list a recorded element the rule doesn't only under a schema closed by hand, which no builder makes.

### What I could not check
- CI's time against its 25 minutes, and the full `npm test`.
- Nothing live ran this round. These fixes change write-path checks, a refusal's words and docs, and are tested stack-free.

### Verdict
**PASS**

The story stays `**Status:** Done`.

---

## Round 4

**Date:** 2026-11-21 (UTC)
**Diff:** `git diff 42e4060c HEAD -- src test engineering-team/stories/graph-operations-first-slice/37-seed-firmware*.md`, HEAD `7f25167a`: 35 files, +2070 −185. Most of it is staging's story 47 (`#177`, ADR 0047), merged in at `e8800cb2`. The commits that touch seed-firmware:
- `e8800cb2`: the merge, with its one conflict, in `test/helpers/todaysCreateConcept.js`;
- `0203b4f1`: the Tester's re-aims, deriving every count and giving the oracles' sandbox the new constant;
- `da47c43c`: the builder follows ADR 0047 Decision 9, with two Deviation lines;
- `7f25167a`: ST33's new digest for `pass1_bootstrap`.

**Against:** ADR 0047 Decisions 8 and 9, ADR 0037 Decision 4 and AC1, and round 3's state.

**How it was made.**
- As before: stack-free after `source tmp/a10-37/env.sh`, with no `npm test`, no Docker and no network.
- One more probe built the target over `firmware/active`, and compared each header's and each schema's `word.wordTypes` with what Decisions 8 and 9 make of the files.

**Verdict:** PASS. A fresh live run is warranted before the pull request (below), but it doesn't block.

### Quality gates (run by reviewer, not trusted)
- [x] **The scoped gate: 19 entries.** Round 3's 18, plus `firmware-nodes-hold-their-concepts-keys`, which the merge registered.
  - `npm run gate:status -- --label a10-37-review-r4`: `20261121T052128Z-28891-6da9 [a10-37-review-r4] started 2026-11-21T05:21:28.384Z on 7f25167a+dirty — PASS, exit 0, 1711 passed, 0 failed, 50 skipped, 19/19 suites`. "dirty" is the untracked `node_modules` link, the only entry in `git status`. The same totals as the coordinator's run.
  - The record is `tmp/gate-runs/20261121T052128Z-28891-6da9.json`. Inside it:
    - this story's suites: route 39, target 33, record 9, plan 9, oracles 8, agent 1, live 4 skipped;
    - rule 12's own suites: the rule 10, check and repair 10, its agent 1;
    - `firmware-nodes-hold-their-concepts-keys`: 11;
    - `operations` as a whole passed 1426 with 14 skipped, in 311.0 s.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`.
- [ ] `npm test` was not run: it writes to this Mac's agent-memory instance.

### The merge's conflict
- **The two sides.** Staging's side of `todaysCreateConcept.js` added `runCreateConcept({ body, ta })` and `jsonSchemaWordTypes()`. Story 37's side had `sandbox(ta, supersetOf)` and `todaysConcept`'s `dTag`, `overwrite` and `conceptHeaderOverrides`.
- **The resolution keeps both.**
  - `runCreateConcept` takes `supersetOf` and passes it to `sandbox`.
  - `todaysConcept` builds its body with story 37's fields and calls `runCreateConcept`.
  - The sandbox gives the route `JSON_SCHEMA_WORD_TYPES` from the real module.
- **Both sides' suites pass:** staging's word-types suites, and this story's oracles and target.

### The builder, against ADR 0047 and AC1
- **Decision 8, the schemas.** They take `JSON_SCHEMA_WORD_TYPES` through `conceptNodes` (`_concepts.js:222`), which story 47 changed for graph create-concept and which the builder shares. Pass 2 keeps the 1a word block, as save-schema does.
- **Decision 9, the headers.**
  - `readFirmware` reads each header file's `word.wordTypes` (`target.js:161`).
  - 1a appends them after `['word', 'conceptHeader']`, once each, in the file's order (`:304`). `handleCreateConcept` does the same (`index.js:1226-1232`) with what pass 1a passes it (`install.js:205`).
- **The probe:** 460 nodes and no problems.
  - All 41 headers' word types equal create-concept's own plus their file's keys. Eight headers add keys, the eight Decision 9 names.
  - All 41 schemas' word types equal the constant.
- **The oracle runs today's code, not a copy.** Its pass 1a passes the header file's `wordTypes` exactly as `install.js` does (`todaysFirmwareRoutes.js:317`), and it runs today's create-concept from source. So ST2–ST5 and SF3 compare the target with today's routes.
- **AC1 holds:**
  - The new rule 12 runs in seed-firmware's own rules check. It finds nothing on a fresh install (SF20).
  - Before the builder's fix it found eight `missing-concept-key` findings, by the test plan's record of the re-aim. Those were the eight headers.

### The re-aims
- **Every count is derived.**
  - `census(dir)` in the fixtures counts from the files, apart from both the oracle and the builder: a header and seven core nodes a concept, eight core edges a concept (create-concept's), the element and set files, a relationship letter a set, graph-rule's element files, and the manifest's existing sets.
  - `FIVE` and `COMMUNITY` are read from the manifest, and first contact's kept nodes from `keptOnFirstContact(o)`.
  - The live suite counts the container's own files (`totalOnTheInstance`).
- **Nothing is loosened.**
  - Each literal count became a derived one with the same comparison: `=== 459` became `=== census().total`, and the `>` and `>=` bounds keep their form.
  - SO5 is stricter. It now checks the set of folded primary properties, worked out from the schema files with the fold's own comparison, where it checked a count of 38.
- **ST33's new `pass1_bootstrap` digest is justified.** Pass 1 of `install.js` changed only by the three-line `wordTypes` pass-through, which the builder follows (the probe). Its other four digests are unchanged, and pass.

### The two new Deviation lines
Both are small.
1. **Each header gets its file's word types as pass 1a passes them.** That is Decision 9's rule.
2. **A header file whose `word.wordTypes` isn't key-form refuses `firmware-unreadable`.** Today's create-concept answers that with a 400, and the install goes on without that concept. This joins round 1's list of files that don't hold together. It is untested: R4-N1.

### Does the live check still stand?
- **For what it covered, yes. For this code and firmware, not wholly.** It ran on `d90418c4`'s code over the pre-merge firmware, 459 nodes. Since then:
  - the firmware gained a graph-rule item and changed eight headers' word types and every schema's;
  - today's install, the side L1 compares against, now passes word types;
  - seed-firmware's own rules check now runs rule 12's scan, which the live timing never included.
- **I expect it to pass.** The stack-free oracle pins node content against today's routes, and nothing in story 47 touches the edge passes, which only L1 compares live.
- **A fresh live run is warranted before the pull request:** L1–L4 and the agent's timed install, on a scratch stack, so the Evidence describes the merged code. It doesn't block.

### Round 4's findings
- **Blocking:** none.
- **Non-blocking:**
  1. **R4-N1 — `target.js:161-164`: the new `firmware-unreadable` case has no test.** That case is a header file whose `word.wordTypes` isn't key-form. Add a target case beside ST21–ST27.
  2. **R4-N2 — `_seed.js:737`, `rulesCheck`, now runs rule 12 too.**
     - seed-firmware runs every rule that has a scan over each firmware concept's scope (Decision 10). Rule 12's concept scan (`word-types-hold-concept-keys.js:43-68`) takes every node the class thread reaches, the instance's own elements included.
     - On an instance with data, seed-firmware's answer will now carry rule 12's findings on nodes it never wrote, though AC6 says "over the firmware's nodes".
     - **Its cost grows with the instance.** On the target, `word`'s scope alone reaches 447 of the 460 nodes, and the 41 scopes total 1,193 judgments for the firmware alone (a probe over the target's relationships). On an instance with data, `word`'s scope comes close to every node any concept holds, and all of it is judged in one transaction.
     - **Ask:** measure it in the live run. Then scope its items to the firmware's nodes, or say in the answer's words what it covers.

### What I could not check
- The merged code's live behaviour (above).
- CI's time against its 25 minutes, and the full `npm test`.

### Verdict
**PASS**

The story stays `**Status:** Done`.

---

## Round 5

**Date:** 2026-11-21 (UTC)
**Diff:** `git diff 1401e603 HEAD`, HEAD `d7b4c89b`: 7 files, +121 −25. The commits:
- `6d575781`: ADR 0037 Amendment 4, rules check judges the firmware's own nodes;
- `07931675`: the Tester's tests, SF40 for R4-N2 and ST34 for R4-N1;
- `d7b4c89b`: the Implementer's fix, with three Deviation lines.

**One uncommitted change, not mine and left as it is.** The story file carries the coordinator's Evidence update for the live run below: 14 lines, docs only, which no suite reads. My gate ran with it in the tree.

**How it was made.** As in the earlier rounds: stack-free after `source tmp/a10-37/env.sh`, with no `npm test`, no Docker and no network. I read the live records and ran nothing live.

**Verdict:** PASS. R4-N1 and R4-N2 are resolved, and the fresh live run round 4 asked for passes on HEAD's code.

### Quality gates (run by reviewer, not trusted)
- [x] **The scoped gate: the 19 entries of round 4.**
  - `npm run gate:status -- --label a10-37-review-r5`: `20261121T060242Z-3268-6c2a [a10-37-review-r5] started 2026-11-21T06:02:42.755Z on d7b4c89b+dirty — PASS, exit 0, 1713 passed, 0 failed, 50 skipped, 19/19 suites`. The totals equal the coordinator's run. "dirty" here is the untracked `node_modules` link and the coordinator's uncommitted Evidence lines.
  - The record is `tmp/gate-runs/20261121T060242Z-3268-6c2a.json`. Inside it:
    - this story's suites: route 40 (SF40 among them), target 34 (ST34 among them), record 9, plan 9, oracles 8, agent 1, live 4 skipped;
    - `operations` as a whole passed 1428 with 14 skipped, in 317.5 s.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`.
- [ ] `npm test` was not run: it writes to this Mac's agent-memory instance.

### Round 4's findings

| Round 4 | The fix | Tested by | Now |
|---|---|---|---|
| R4-N1, the `wordTypes` refusal untested | Test only | ST34 (`seed-firmware-target.test.js:506`): a key with a space and a number are each a problem naming the file; a list of keys is no problem | Resolved |
| R4-N2, rules check's reach | Amendment 4. `rulesCheck` (`_seed.js:740`) takes the firmware's own nodes, the target's addresses the graph holds (`:753`). Each rule lists their items with its own node-scope `scan` (`:761`) and judges them in one call (`:763`). Unjudged items are left out (`:764`), and `judged` counts nodes (`:774`). | SF40 (`seed-firmware.test.js:884`): rover, a firmware element whose `dog` key was taken out by hand, is reported. The instance's own Biscuit and another author's relay, each shown to break rule 12 by `rules check` over it alone, aren't. Every finding is on a node seed-firmware wrote, and `judged` is at most the target's count. | Resolved |

### Its reach and cost
- **No class-thread walk over the instance.** The keys come from the target's ~460 addresses.
  - Rule 12's node scope is the node itself, with no read (`word-types-hold-concept-keys.js:70`).
  - Rule 11's is one indexed read a key (`property-has-one-parent.js:82`).
  - Each rule's judgment is one batched call. Its concept lookup walks up from each node to the concepts that reach it, as a check over one node does, never down a concept's elements.
  - So the cost follows the firmware, not the instance.
- **The shape stands.** The findings come in rules check's order. The `rules`, `judged`, `findings`, `first` and `more` fields are kept, and the declaration's `rulesCheck` description says "the firmware's own nodes".
- **Live, on a fresh install:** rules check ran both rules and judged 416 nodes (41 headers, 287 core nodes, 88 elements), with 0 findings (`r2-install.json`'s `rulesCheck`). The 22 sets and 22 relationship letters have no JSON for rule 12 to judge, and are no Property for rule 11.

### The three Deviation lines
All three are small and accurate.
1. **Items node by node, judged in one call per rule.** Each rule keeps its own reach, and the line gives the timings it was chosen on.
2. **`judged` counts nodes, not items.**
3. **The firmware's nodes are found by the target's addresses.** So a set's relationship letter (a stand-in address in the target) and the installed-firmware graph aren't judged. Neither rule could find anything on them, which I checked: rule 12 reports a node with no JSON as unjudged, and rule 11 judges only Property nodes.

### The fresh live run (round 4's recommendation)
The records are `tmp/live-check-37/r4-*.log`, with this run's `r2-*.json`.
- **The code it ran was HEAD's.** `r4-setup.log` gives `d7b4c89b`, and the container's `target.js`, `_seed.js` and `seed-firmware.js` match the worktree's by digest.
- **L1, L3 and L4 pass.** First contact kept the four schemas pass 3b filled and the three concept graphs. The same two prune links were kept with `noRecord`, and the same two were the instance's own.
- **L2 passes**, on the emptied graph.
- **The agent, through the external CLI:**
  - it installed 460 nodes in 30 s through nginx, with `cacheOutOfDate` 0;
  - it resolved its own `dog`;
  - after offload-all (417 tags) and derive-all, a repeat answered 460 `unchanged`, with no change entry;
  - `seeded` then read 460 nodes, 936 relationships and `changedSince` 0.
- **The story's Evidence matches these records** (the uncommitted lines above).

### Round 5's findings
- **Blocking:** none.
- **Non-blocking:** none.

### What I could not check
CI's time against its 25 minutes, and the full `npm test`.

### Verdict
**PASS**

The story stays `**Status:** Done`.
