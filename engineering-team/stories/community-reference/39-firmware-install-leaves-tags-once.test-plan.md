# Test Plan: Story 39 — A firmware install leaves each header's tags once

**Story:** `engineering-team/stories/community-reference/39-firmware-install-leaves-tags-once.md`
**ADR:** `engineering-team/decisions/community-reference/0035-community-references-import-then-prune.md`
**Date:** 2026-11-21

## Coverage map

Two suites, both stack-free:
- **`test/community-references-prune-builder.test.js` (P1–P9):** the new `buildPruneCypher`. Each test runs the real `buildImportCypher`'s statements, then the prune's, on the Cypher engine, and reads the graph they leave.
- **`test/firmware-install-leaves-tags-once.test.js` (S0–S10, E1–E5):** install's real community references and the edge wiring after them, `install({ pass1: false, pass2: false })`, run in a child process over the same engine. Each scenario starts from a graph built the way today's code builds one.

The checks are on the graph, never on Cypher text. "Holds its letter's tags once" means the node's tag nodes are exactly those one import of its current letter makes on an empty graph: the real builder says which, so no uuid formula is written into the tests.

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 | P1: after Pass 1's tags and the seeded letter's, the prune leaves the seeded letter's tags, each once | `community-references-prune-builder` | builder on the engine |
| AC-1 | P2: importing and pruning the same letter again changes nothing, down to the tag nodes themselves | same | builder on the engine |
| AC-1 | S1: after one install, each header with a community reference holds its letter's tags once, b included, and one `REFERENCES {source:'b-tag'}`, to the community header | `firmware-install-leaves-tags-once` | install step in a child |
| AC-1 | S2: after two installs in a row, the same | same | install step in a child |
| AC-1 | S3: a header whose letter already carries the b, which no install signs again (feat/tags' installs), ends with its letter's tags once, and is neither signed nor published | same | install step in a child |
| AC-1 | E2: with none of the community letters on the relay, each header still holds its letter's tags once | same | install step in a child |
| AC-2 | P4: a copy holding three versions' tags keeps only the newest's, and the old tag nodes are gone | `community-references-prune-builder` | builder on the engine |
| AC-2 | P5: with `derivedEdges`, the b-derived relationships the newest version doesn't make go: a `REFERENCES` to itself and an `INHERITS_FROM` | same | builder on the engine |
| AC-2 | P6: with `derivedEdges`, the relationships the newest version's b tags derive stay, one each | same | builder on the engine |
| AC-2 | S4: community headers and supersets holding several versions' tags keep only the tags of the version the install brings in | `firmware-install-leaves-tags-once` | install step in a child |
| AC-2 | S5: a copy keeps only the relationships its version's b tags derive | same | install step in a child |
| AC-3 | S6: on the instance that curates nostr-relay's reference, the header carries no b naming itself and has nothing to itself, and its superset holds its tags once with nothing to itself | same | install step in a child |
| AC-3 | S7: that instance signs, publishes and fetches nothing for that reference, while the other five are seeded and fetched | same | install step in a child |
| AC-3 | S8: `pass_communityReferences` hands the edge wiring no entry for that reference, and one for each other | same | install step in a child |
| AC-4 | S9: a staging-shaped graph of today is clean after one install | same | install step in a child |
| AC-4 | S10: a production-shaped graph of today is clean after one install | same | install step in a child |
| AC-4 | E1: a second install on production leaves it as clean as the first | same | install step in a child |

**What AC-4's "clean" means** (S9, S10, E1). Every node the six references touch must meet the checks below. Those nodes are the instance's six headers and six supersets, and each copy strfry holds a letter for.
- It holds its letter's tags once.
- It has no relationship to itself.
- A copy has exactly the `b`-derived relationships its letter derives.
- Each own header whose reference the instance doesn't curate has one `REFERENCES {source:'b-tag'}`, to the community header.
- No tag node is left that nothing holds.

**S0** checks that the manifest still has the references the story names, with nostr-relay's curator curating no other.

**The ADR's other guarantees:**

| Guarantee | Test | Level |
|---|---|---|
| A tag node another node also holds loses only this node's link to it (Decision 1, the care of `TAGS_DROP`) | P3, with two letters whose ids end alike: the ledger row's 32-bit tag key | builder |
| Without `derivedEdges`, `b`-derived relationships stay (Decision 4) | P7 | builder |
| The prune touches only tag nodes and `b`-derived relationships. The node's labels, properties and every other relationship stay: a `firmware-community` stub, `AUTHORS`, an incoming `IS_A_SUPERSET_OF`, one made by hand. So does a node an old tag pointed at | P8 | builder |
| The prune escapes its values: a d-tag and a `b` target holding a quote and a backslash | P9 | builder |
| A failed import never reaches its prune (Decision 2) | E3: the copy keeps the tags it held | step |
| A dry run changes nothing, the self-curated reference included (Implementation notes §2) | E4 | step |
| An own header's `b`-derived relationships aren't pruned (Decision 4) | E5: a `REFERENCES` from a `b` its owner authored survives | step |
| Which reference is the instance's own is decided by its assistant at run time, never a literal | S1, on staging's made-up assistant, seeds nostr-relay's `b`; S6–S8, on production's assistant read from the manifest, skip it | step |

**E3, E4, E5 and S0 pass before the fix too.** They guard what the fix must not break.

**How AC-1 reads beside E5.** AC-1's "exactly one `REFERENCES {source:'b-tag'}`" is checked on headers whose owner authored no `b`. That is the state of every instance the book cleans. E5 pins Decision 4 for a header that has one: the owner's relationship stays beside the firmware's. What a reinstall keeps of an owner's `b` is the queued lost-`b` fault's to decide (`stories/_intake.md`, 2026-11-21).

### Existing suites, unchanged

All four pin firmware's community-references step and pass today. They must still pass after the change:

| Suite | Tests | What it pins |
|---|---|---|
| `test/b-tag-primitive.test.js` | 16 | The never-clobber check, the seed's literal, OQ-1's order, and AC-7 |
| `test/b-tag-seeds.test.js` | 7 | The manifest's seeds |
| `test/community-reference-nostr-relay-stub.test.js` | 4 | ADR 0005's sub-pass |
| `test/community-reference-superset-link.test.js` | 4 | ADR 0008's superset link |

AC-7 refuses any "delete", in any case, within 200 characters of `firmware-community` in `install.js`. The ADR's design passes it as written (see "Checked before the gate"), so no test is re-aimed. `test/registry.js` gains the two new suites.

## Edge cases

- [x] **Nothing to fetch:** none of the community letters on the relay (E2).
- [x] **A failing import** of a copy (E3).
- [x] **A pinned reference:** three of the copies in S4 and S9 hold their one pinned version (`knownGoodEventId`), and the install brings in the same version again.
- [x] **Shared tag nodes**, from two ids that end alike (P3).
- [x] **Quotes and backslashes** in an address and a `b` target (P9).
- [x] **A dry run** (E4).
- [x] **An owner-authored `b`'s relationship** on an own header (E5).
- [x] **Two different assistants over the same manifest** (S1 against S6–S8).
- [ ] **Concurrent calls:** not covered. Firmware install runs one at a time, and the story asks nothing of two at once.
- [ ] **Concept Graph API unavailable:** not covered. These suites don't use the API.
- [ ] **Concept handle not found:** not covered. A missing local header skips the seed today (graceful), and the story doesn't change that.
- [ ] **A contrast or colour check:** not applicable.

## Test infrastructure

- **Test framework:** Node's own runner, each suite's `run()`, through the gate engine (`test/registry.js`). A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- **Concept Graph API:** none. This Mac's local container is the owner's agent-memory instance, so no test here reaches a stack. The live check is the book's reinstall of staging, on the owner's yes (ADR 0035, OQ-4).
- **Firmware state:** none. The suites read `firmware/active/manifest.json`'s six community references and build each instance's graph themselves.
- **Fixtures:**
  - `test/helpers/communityStep.js` holds:
    - letters, with NIP-01 ids and placeholder signatures, since nothing on this path checks a signature. So any pubkey can sign one, production's assistant included;
    - the tags create-concept signs into a header and a superset;
    - the two imports today's code runs: `pass1Import` (normalize's `importEventDirect`, statement for statement, then create-concept's labels) and `todaysImport` (the real `buildImportCypher`);
    - `importMakes`;
    - a strfry and a relay that keep letters as NIP-01 says;
    - readers over the engine's graph.
  - `test/helpers/communityStepChild.js` is the child. It runs `install({ pass1: false, pass2: false })`, or `pass_communityReferences` alone, over the engine, after Pass 1's part of each install: each concept's header and superset signed again and imported as create-concept does. Its stubs:

    | Module or route | The stub |
    |---|---|
    | `eventSync.js` | The real builders, with an `executeCypher` that runs each statement on the engine, committed or rolled back on its own as cypher-shell does |
    | The driver | Runs on the engine |
    | `helpers.js` | A signer for the assistant |
    | `assistantKeys.js` | The scenario's assistant |
    | `fetch` | The routes install calls: strfry's scan and publish, the relay, the Cypher route, and Pass 3's routes |
    | `child_process` | Launching anything throws |

    It never opens Neo4j, strfry, a relay, a file or the network.
  - **The scenarios** are built in the step suite:

    | Scenario | What it is |
    |---|---|
    | `freshInstance` | Before the first install |
    | `neverResigned` | tags.brainstorm.world's shape |
    | `stagingToday` | Production's copy at 9 versions, as read on staging |
    | `productionToday` | The production-shaped graph |

    Each is built from the mechanism ADR 0035's Context names: Pass 1's import, today's seed, today's copies, today's wiring.
- **The fixtures were checked against today's code.** A scratch run of today's install from an empty graph matched the hand-built graphs node for node, in labels, tag contents and relationships:
  - 24 of 24 nodes for the staging shape;
  - both of production's own nostr-relay nodes.

  The staging-shaped fixture also reproduces staging's live counts: 61 tag nodes on the copy of production's header and 63 on its superset (story #39's Background).
- **For the Implementer:**
  - `buildPruneCypher(event[, { derivedEdges }])` returns an array of strings, as `executeCypher` takes. Its statements must fall within the engine's subset (`test/helpers/cypherEngine.js`'s header). The ADR's statements do.
  - The child answers only the routes it lists. A call to any other fails the step suite with "install asked for what the child doesn't answer". The ADR's loop removal runs through `runCypherApi`, which the child answers on the engine.
  - E3 finds the import it fails by `buildImportCypher`'s first statement, `MERGE (e:NostrEvent {uuid: '<address>'})`, which the ADR leaves as it is.
  - E4 reads install's existing dry-run line, `(dry-run) <slug> → …`, for the five other references.
  - Story 38's AC-7: keep the loop-removal helper's statements near `runCypherApi`, and keep the words at its call site in `pass_communityReferences` free of "delete".
- **Porting to `feat/tags`** (ADR 0035 §4 leaves this to the Tester). That branch has the gate engine, the registry and `src/lib/bValueForms.js`, but no Cypher engine and no `src/lib/tapestry-key-cypher.js`.
  - The port PR carries both suites, and `test/helpers/cypherEngine.js` as it is: it is test-only and needs nothing but `crypto`.
  - Two helpers adapt to that branch: `communityStep.js`'s `pass1Import` follows its `importEventDirect`, and the child's route list follows its Pass 3.
  - Its installs never sign a header again, so S3 is the scenario that shows it heals.

## How to run

Never the full `npm test` on this Mac: about 40 suites reach the agent-memory instance. Run with every endpoint dead:
- a folder first on `PATH` holding a stub `curl` (exit 7) and a stub `docker` (exit 1);
- `BRAINSTORM_CONF_PATH` set to a conf whose `NEO4J_URI` is `bolt://127.0.0.1:9`;
- `BRAINSTORM_BASE_URL=http://127.0.0.1:9` and `TAPESTRY_PORT=9`, with `TAPESTRY_CONTAINER` and `TAPESTRY_CONTAINER_PORT` unset.

Each new suite on its own:

```
node test/community-references-prune-builder.test.js
node test/firmware-install-leaves-tags-once.test.js
```

The step suite takes about 2.5 seconds: twelve child runs, each loading install.

**The scoped gate for Implementation and Review** runs these six suites through `test/helpers/gateRunner.js`'s `runGate`, in that environment:
- the two new suites;
- the four existing suites above.

Leave out:
- `event-tagging-firmware-seed`, which calls the local control panel;
- `stack-free-npm-test`, which stays CI's: its G2 probes `BRAINSTORM_BASE_URL`, or `localhost:7778` when that is unset, and runs live tests when a control panel answers. It ran once at this gate, in the environment above with G2 skipped, to show G5 passes with the two new suites registered.

Read the verdict with `npm run gate:status -- --label <label>`.

## Verification

**The new tests fail on today's code,** each for want of what the story builds. Confirmed on 2026-11-21 at `1ea93f78` (the ADR's commit), with this phase's files in the working tree and every endpoint dead.

The gate run is `20261121T160716Z-75710-67a4`, label `header-tags-once-39-test-design`. It covers the six suites above plus `stack-free-npm-test` for G5. `npm run gate:status` reads:

```
20261121T160716Z-75710-67a4 [header-tags-once-39-test-design] started 2026-11-21T16:07:16.370Z on 1ea93f78+dirty — FAIL, exit 1, 41 passed, 21 failed, 1 skipped, 7/7 suites; failed: community-references-prune-builder, firmware-install-leaves-tags-once
```

```
community-references-prune-builder: FAIL (0 passed, 9 failed, 0 skipped)
firmware-install-leaves-tags-once: FAIL (4 passed, 12 failed, 0 skipped)
b-tag-primitive: PASS (16 passed, 0 failed, 0 skipped)
b-tag-seeds: PASS (7 passed, 0 failed, 0 skipped)
community-reference-nostr-relay-stub: PASS (4 passed, 0 failed, 0 skipped)
community-reference-superset-link: PASS (4 passed, 0 failed, 0 skipped)
stack-free-npm-test: PASS (6 passed, 0 failed, 1 skipped)
Overall: FAIL — 41 passed, 21 failed, 1 skipped across 7 suites
```

**Why each fails:**
- **P1–P9:** `src/api/neo4j/eventSync.js exports no buildPruneCypher yet (ADR community-reference/0035 Decision 1: a new export beside buildImportCypher)`.
- **S1, S2, E2:** each of the six headers holds 13 tag nodes, where its letter has 7: Pass 1's six beside the seeded letter's seven. For example:
  ```
  39998:580923c1…:tag holds 13 tag nodes; its letter 6395e351… has 7 tags, and one import of it makes 7. Repeated: d ×2, names ×2, slug ×2, concept-graph ×2, json ×2, description ×2
  ```
- **S3:** the same 13. Today's never-clobber branch leaves the header as it is.
- **S4:** the copies keep every version's tags, for example:
  ```
  39998:919ba08a…:nostr-relay holds 67 tag nodes; its letter ea23df5c… has 6 tags … Repeated: d ×10 … b ×7
  ```
  Before the install it held 61, and its superset 63.
- **S5:** the copy keeps `REFERENCES {source:'b-tag'}` to itself and an `INHERITS_FROM` that its new version no longer derives.
- **S6:** each of these:
  - production's nostr-relay letter carries a `b` naming its own address;
  - the header holds that `b` and a `REFERENCES {source:'b-tag'}` to itself;
  - it holds 13 tag nodes;
  - its superset holds 14 and has `IS_A_SUPERSET_OF` to itself.
- **S7:** for that reference the step signed 1 letter, published 3, and asked the relay twice.
- **S8:** pending holds an entry for nostr-relay, from its header to itself.
- **S9, S10, E1:** all of the above, on the whole staging-shaped and production-shaped graphs.
- **E3, E4, E5 and S0 pass,** as the guards they are.

**Checked before the gate.** A throwaway implementation, written to ADR 0035's Implementation notes, went into a scratch copy of the repo. It was never in the worktree and isn't committed. With it:
- all 25 new tests passed;
- the four existing suites passed unchanged, Story 38's AC-7 and OQ-1 included.

Twelve deliberate mistakes were then applied to it one at a time. Each was caught:

| Mistake | Caught by |
|---|---|
| The copy pruned before its import | E3 |
| Copies pruned without `derivedEdges` | S5, S9 |
| No skip for the self-curated reference | S6, S7, S8, S10, E1 |
| The skip without removing the loops | S6, S10, E1 |
| The loops removed on a dry run | E4 |
| No import-and-prune on the "already has a `b`" path | S3 |
| That path signing and publishing again | S3 |
| Shared tag nodes deleted | P3 |
| Own headers pruned with `derivedEdges` | E5 |
| Every `REFERENCES` pruned, not only `b-tag` | P8 |
| The prune's address unescaped | P9 |
| The curator compared with a literal pubkey | S1, S2, S3, S4, S5, S9, E2, E3 |

## Amendment 1 (review round 1, 2026-11-21)

ADR 0035's Amendment 1 answers review round 1, after the branch merged `staging`. Its tests are in `test/firmware-install-leaves-tags-once.test.js`:

| Finding | Test | Level |
|---|---|---|
| Blocking 1 (item 1) | S11: seed-firmware's target under nostr-relay's curator gives that header no pointer `b`, no claim and no `references` entry, and each other reference's header its own. Under staging's made-up assistant, all six keep theirs | `src/firmware/target.js`, in-process |
| Blocking 1 (item 1) | S12: the oracle, `test/helpers/todaysFirmwareRoutes.js`, under the same assistant signs no `b` on it, and agrees with the target | the oracle, in-process |
| Blocking 2 (item 2) | E6: a seeded header whose prune fails keeps its `REFERENCES {source:'b-tag'}`, and the wiring makes no stub of it | install step in a child |
| Blocking 2 (item 2) | E7: the same on the "already has a `b`" path | install step in a child |
| Blocking 2 (item 2) | E8: a seeded letter whose import fails after its publish gets no stub either | install step in a child |
| Non-blocking 4 (item 6) | S0 now checks the six references the story names | the manifest |

**Other changes:**
- **The child gains `failPruneAt`.** It refuses a batch that imports nothing and deletes at the address given.
- **The fixture's comment** (Non-blocking 3, item 5) now says it models the graph once production has healed.
- **ST33's digest** isn't one of this story's tests. It's updated once `target.js` follows item 1, as ST33's procedure says.
- **The guards.** After the fix, a scratch edit taking out each guard must fail its test:

  | Guard taken out | Its test |
  |---|---|
  | The target's skip | S11 |
  | The oracle's skip | S12 |
  | `seededB` set before the prune | E6, E7 |
  | `seededB` set before the import | E8 |

**The scoped gate for round 2** runs on the merged branch. Its list is derived from that diff, so it gains:
- seed-firmware's lifecycle suites, which read `install.js` and `target.js`;
- the suites that read `BIBLE.md`, for item 4.

**Verification.** The new tests fail for want of items 1 and 2. Confirmed on 2026-11-21 at `30c0c6a7` (Amendment 1's commit), with these tests in the working tree: `firmware-install-leaves-tags-once: 16 passed, 5 failed`, the five being S11, S12, E6, E7 and E8.

```
S11: its header carries [["b","39998:919ba08a…:nostr-relay","pointer"]]; it claims REFERENCES {source:'b-tag'} to 39998:919ba08a…:nostr-relay; references lists 39998:919ba08a…:nostr-relay, the instance's own header
S12: nostr-relay: the oracle signs [["b","39998:919ba08a…:nostr-relay","pointer"]]; it should sign []
E6, E7, E8: 39998:580923c1…:tag has REFERENCES {source:'firmware-community'} to 39998:82b75e47…:tag; it should keep its one REFERENCES {source:'b-tag'}, to 39998:82b75e47…:tag, and the wiring make no firmware-community stub of it
```

### Round 2's independent check (Amendment 1, as revised)

Review round 2's independent check found what the round's first tests left open. Amendment 1 was revised to answer it, and these tests pin it:

| Finding | Test | Level |
|---|---|---|
| Item 2 | E9: a header on the "already has a `b`" path whose import fails keeps its `REFERENCES {source:'b-tag'}`. It passes already: it guards `seededB` being set before that path's import | install step in a child |
| Item 2 | E10: a seeded letter whose publish is answered 200 with `success: false` counts as unpublished. The wiring is told `seededB` false, and the letter isn't imported | `pass_communityReferences` in a child |
| Item 8 | S13: graph sets' `firmwareLinks` (`src/operations/catalog/graph/_sets.js`, part d) under nostr-relay's curator leaves out that reference's community link, and keeps each other's. Under staging's made-up assistant, all six are firmware's | `_sets.js` in a child with the assistant stubbed |

The child gains `failPublishAt`: the publish route answers 200 with `success: false` and stores nothing, as it answers a failed `strfry import`. The fixture's comment now says staging keeps the loop "until its next install after production's".

**Verification.** Confirmed on 2026-11-21 at `2ccbb056` (the revision's commit), with these tests in the working tree: `firmware-install-leaves-tags-once: 22 passed, 2 failed`, the two being E10 and S13. E9 passes, as the guard it is.

```
E10: the wiring is told seededB true for tag, though strfry never stored its seeded letter: seededB says whether the header's stored letter carries the b (ADR 0035 Amendment 1 item 2)
S13: it counts superset-of:39998:919ba08a…:nostr-relay node:39999:919ba08a…:nostr-relay-superset, the instance's own superset under itself, as firmware's
```

## The feat/tags port (2026-11-22, ADR 0035 §4)

**Where the tests live.** They are on `port/header-tags-once-tags`, cut from `feat/tags` at `25d39636`, the branch tags.brainstorm.world deploys. They were committed there failing as `67872714`, and are not on this record branch. The port PR into `feat/tags` carries them with the fix.

**What carries over as it is:**
- **`test/helpers/cypherEngine.js`.** It is test-only and needs nothing but `crypto`.
- **`test/community-references-prune-builder.test.js`** (P1–P9).
- **`test/helpers/communityStepChild.js`.** Everything it stubs is what `feat/tags`' install uses:
  - after its community step, the install calls the four routes the child answers: `derive-all`, `derive-status`, `apply-enumerations` and `wire-implicit-elements`;
  - from normalize's helpers it takes only `loadTAKey` and `signAndFinalize`;
  - it finds its assistant through `getOwnerAssistantPubkey`.

**What adapts:**
- **`test/helpers/communityStep.js`.** `pass1Import` follows `feat/tags`' `importEventDirect` (`src/api/normalize/index.js:135-177`), and the labels create-concept sets there (`:1280-1283` and `:1324`).
  - That branch has no `TapestryNode` label and no `src/lib/tapestry-key-cypher.js`. So the adoption statement and `keyNode` go, and each statement matches `NostrEvent` alone.
  - The helper's header names that branch's lines.
- **`test/firmware-install-leaves-tags-once.test.js`:** S0–S10 and E1–E10, 21 cases. Three comments name that branch's lines: the seed (`install.js:1059-1063`), a copy's import (`:1094`, and `:1122-1126` for a superset) and the wiring (`:1251-1302`).
- **`test/registry.js`:** the two suites, at the end of the list.

**What's left out.** S11, S12 and S13 stay out, with `test/helpers/todaysFirmwareRoutes.js` and `test/lifecycle/seed-firmware-target.test.js`'s ST33.
- They test seed-firmware's target and oracle, and graph sets' model of firmware's links. `feat/tags` has none of these.
- So the fix's parts in `src/firmware/target.js` and `src/operations/catalog/graph/_sets.js` don't port either.

**Which path a tags install takes** (corrected at review, 2026-11-22). This paragraph first said that a routine tags install signs no header again, and takes S3's path. In fact it signs every header again:
- **The duplicate check never matches.** `feat/tags`' Pass 1 calls create-concept with no `overwrite` (`install.js:184-190` after the port). But create-concept's duplicate check there compares stored pubkeys with a double-encoded key (`src/api/normalize/index.js:1198`), so it never matches.
- **Staging fixed that check** in `f3347d276`, which `feat/tags` doesn't have.
- **So each install there signs every firmware header again,** with no `b`, and the community step seeds it. That is the path S1, S2, S9, S10 and E1 run, and S9's staging-shaped graph is tags' shape.
- **S3's path,** the "already has a `b`" one, runs there only in an install with Pass 1 off.
- Both paths run the same community step. ADR 0035's Correction of 2026-11-22 has the details.

**How to run.** Use the environment above: the dead conf, the closed ports, and curl and docker stubbed first on `PATH`. From a checkout of the port branch:
- `node test/community-references-prune-builder.test.js`
- `node test/firmware-install-leaves-tags-once.test.js`

The Implementer's gate runs these two, and every suite registered on that branch that loads or reads `src/api/neo4j/eventSync.js` or `src/firmware/install.js`. The list comes from the port's diff.

**Verification (2026-11-22).** Run on `feat/tags`' code, with only the tests added:
- **The builder suite:** 0 passed, 9 failed. Each fails with "src/api/neo4j/eventSync.js exports no buildPruneCypher yet (ADR community-reference/0035 Decision 1: a new export beside buildImportCypher)".
- **The step suite:** 4 passed, 17 failed.
  - S0, E3, E4 and E5 pass, as they did on staging before the fix.
  - The rest fail on the bug:
    - each header holds 13 tag nodes where its letter has 7, on both paths (S1–S3);
    - a community copy keeps every version's tags: the copies of production's header and superset go from 61 and 63 tag nodes to 67 and 70 (S4);
    - on the curator's instance, the header carries a `b` naming itself, and it and its superset point at themselves (S6);
    - the wiring is told `seededB` before the letter is stored (E8, E10).
  - E6, E7 and E9 report that the path under test didn't run. Nothing prunes yet, and the "already has a `b`" path imports nothing.
- **Green, after the port:** both suites pass in full, 9 and 21.
