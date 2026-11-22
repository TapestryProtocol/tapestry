# Test Plan: Story 48 — Declare one of the instance's own concepts shared, wire it, or mark it deliberately unaffiliated, through the graph operations

**Story:** `engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.md` (as amended at Architecture)
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0048-declare-shared-wire-to-shared-defer-sharing.md` (accepted 2026-11-21; its Amendment 1, written at Test Design to answer this plan's questions, is pinned here, pending the owner at this gate)
**Date:** 2026-11-21

Every suite here is stack-free and lives under `test/operations/`, where `test/operations.test.js` finds and runs it, so none needs a line in `test/registry.js`:
- **The three operation suites** run the real catalog in a child (`test/helpers/operationsHarness.js`) over a graph kept in a file. Every statement runs on the Cypher engine (`test/helpers/cypherEngine.js`, through `cypherGraphFake.js`), with Tapestry's uniqueness rules. The harness's spy watches everything that signs or reads a key.
- **The export cases** run export nostr's own harness (`test/helpers/exportFixtures.js`): its world, the fake relays and strfry import, and the assistant's key. Every `b` they send is written by the new operations.
- **The agent suite** runs the real catalog behind `test/helpers/externalCliServer.js`. The agent is `clients/cli/bin/tapestry.js`, with an admin's own key.

Two existing tests change: MF15 (`mark-field.test.js`) and EN29 (`enumerate.test.js`) pin the catalog's "At a glance (62 operations)". Decision 10 makes it 65, so both now ask for 65, as story 19's Test Design moved MF15 from 61 to 62. They fail until the catalog changes.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: declare | **DS1** lamp (no letter): `declared`; the header holds `["b", "39998:<TA>:lamp", "pointer"]` once and the self-loop `REFERENCES {source:'b-tag'}` once; the answer's concept, disposition (self-declared) and `disposition.bValues`; `letterOutOfDate` false. **DS2** each declared header's other tags and JSON as they were, and nothing else in the graph changed. **DS3** one entry, `graph declare-shared`, the owner's: `tag-added` and `relationship-added` exactly, in the existing shapes; graph history finds it by the header. **DS4** beagle (lettered): `letterOutOfDate` true. **DS5** a repeat: `already-declared`, `change` null, nothing written; cat, whose `b` names its own address untyped: `already-declared`. **DS6** the marker goes: kite's one and bird's two, each a `tag-removed`. **DS11** nothing signed, though the calls ran | `test/operations/graph/declare-shared.test.js` | operation |
| AC2: wire | **WS1** lamp → relay (held): one pointer `b`, its `REFERENCES` to relay's header, `target { address, held: true, node }`, disposition wired, its entry. **WS2** lamp → FISH (not held), beside the `b` it holds: a placeholder of import nostr's kind; `held: false`; the entry names it; graph history finds it; `bValues` both, sorted. **WS4** an naddr gives the address's `b`, and the address then answers `already-wired`, its `target` as the first call's. **WS5** a repeat: `already-wired`, `change` null, `target` read from the graph; mouse's inherit-typed `b` naming relay counts, and no relationship is drawn. **WS6** kite's marker goes. **WS7** beagle: `letterOutOfDate` true. **WS9** lamp ends with exactly the three pointer `b`'s, its other tags and JSON as they were; nothing else changed. **WS14** nothing signed. **WS17** gong, whose `b` names an address with no node: `already-wired`, `target { address, held: false, node: null }`, nothing written, no relationship drawn | `test/operations/graph/wire-to-shared.test.js` | operation |
| AC2: defer | **DF1** lamp: `deferred`; the marker once; no relationship; one `tag-added`. **DF2** a repeat, and kite (one marker) and bird (two, its `bValues` listing the marker once): `already-deferred`, nothing written. **DF3** beagle: `letterOutOfDate` true. **DF5** deferred, then declared or wired: the marker goes. **DF6** other tags and JSON as they were; nothing else changed. **DF9** nothing signed | `test/operations/graph/defer-sharing.test.js` | operation |
| AC3: refusals | the table below; **DS10**, **WS13**, **DF8** the callers | the three suites | operation |
| AC4: export sends them | **EB1** pet's header letter carries its self-pointing `b` and its `b` naming cat, each once, as the node holds them, signed by the assistant and read back; neither relationship reported uncarried. **EB2** a dry run lists the header `new` before it was sent, then `changed` once sent and wired again, its added tags the new `b`'s. **EB3** each element carries a `z` for cat, and pet's own `z` once. **EB4** wired to six: five stamps each. **EB5** the marker travels: animal's first letter carries `["b", "b-tag-deferred"]`. **EB6** bird's three old `b`'s beside the new one | `test/operations/export/nostr-shared-concepts.test.js` | operation |
| AC5: declared once | **DS13**, **WS16**, **DF11** one declaration each, listed with kind, access, inputs, `repeatKey` and refusals, `/docs` POST; **DS10**, **WS13**, **DF8** the internal command | the three suites | operation |
| AC5: the catalog and docs | **DS14** catalog §2 rows, "At a glance" (65, 29 graph writes, the three under concepts), §9's row for the three routes and set-b-tag's own row, still to place; BIBLE §25; inherit-from.md; the skill's sentence. **MF15**, **EN29** count 65 | `declare-shared.test.js`, `mark-field.test.js`, `enumerate.test.js` | docs |
| AC5: an agent | **XS1** the agent makes toy and game, declares toy shared, wires game to it, is refused a bad target, dry-runs and exports both; the letters read back from the own relay by id carry toy's self-pointing `b`, game's `b` naming toy, and the stamp for toy on game's element; history has the declaration as the agent's | `test/operations/graph/shared-concepts-agent-through-cli.test.js` | agent |
| Decision 4: locks | **DS12**, **WS15**, **DF10** the transaction's first statement is the concept-header concept's lock, and the next is a write naming the concept's header, with nothing read before it | the three suites | operation |
| Decision 6: the relationship | **DS7** drum's self-loop from an import isn't doubled or recorded. **WS3** a placeholder only when no node of any label is at the address. **WS8** hoop's import-drawn `REFERENCES {source:'b-tag'}` isn't doubled or recorded; firmware's `{source:'firmware-community'}` stub isn't matched | the suites | operation |
| Amendment 1 item 1: `held` | **WS3** `held` is true only for a node at the address that isn't a placeholder: dog house's header, held; lamp's placeholder at FISH, which kite then wires to, `held: false` with `node` its key and no second; seed-firmware's placeholder at NEWT (a `TapestryNode` with no `created_at`), the same. **WS1**, **WS7** lettered headers, held | `wire-to-shared.test.js` | operation |
| Amendment 1 item 2: `bValues` | `disposition.bValues` is exactly the header's `b` values after the call, as strings, once each and sorted: DS1, DS5, DS6, WS1, WS2, WS5, WS6, WS8, WS17, DF1, DF2, DF4, DF5 | the three suites | operation |
| Amendment 1 item 4: the order | **WS18** in wire-to-shared, `bad-target` comes first, before any statement runs. It holds on an unknown concept, another author's, a firmware concept and a graph with no concept-header concept. The header's refusals come before `self-target` (relay to its own address) and before the repeat (a widget whose `b` names relay). `self-target` comes before the repeat (cat, whose `b` names its own address). **DS8** a widget whose `b` names its own address: `not-own-concept`, not `already-declared`. **DF7** a widget holding a real `b`: `not-own-concept`, not `affiliated` | the three suites | operation |

### The refusals (each changes nothing)

| Code (status) | declare-shared | wire-to-shared | defer-sharing | Given |
|---|---|---|---|---|
| `unknown-concept` (404) | DS8 | WS12 | DF7 | a key no node has; rover, an element; the node at `39998:<TA>:held` (DS8) |
| `not-own-concept` (409) | DS8 | WS12, WS18 | DF7 | relay, another author's ("another author"); recipe, at the owner's key ("owner"); a widget whose `b` names its own address (DS8), names relay (WS18), or is real (DF7), refused before the repeat or `affiliated`; relay wired to its own address, before `self-target` (WS18) |
| `firmware-concept` (409) | DS8 | WS12 | DF7 | word |
| `not-installed` (409) | DS9 | WS12 | DF7 | a graph with no concept-header concept; the words name it |
| `bad-target` (400) | — | WS10, WS18 | — | text; `39999:…`; an event id; a bad naddr; an naddr of kind 39999; upper-case hex; each naming the input `target`. Also on an unknown concept, another author's, a firmware concept and a graph with no concept-header concept, before any statement (WS18) |
| `self-target` (400) | — | WS11, WS18 | — | the header's own address; an naddr of it (the words name `graph declare-shared`); cat, whose `b` names its own address, before the repeat (WS18) |
| `affiliated` (409) | — | — | DF4 | cat (self `b`, untyped); mouse (inherit `b`); hoop (an event-id `b`) |
| `sign-in-required` (401), `not-allowed` (403) | DS10 | WS13 | DF8 | a visitor; a stranger |
| `wrong-content-type` (415) | DS10 | — | — | a `text/plain` body |

## Edge cases

- [x] The marker is taken out by declare (DS6, DF5) and by wire (WS6, DF5); two markers, two `tag-removed` (DS6).
- [x] A repeat answers its `already-` outcome with `change` null and writes nothing: DS5, WS5, DF2.
- [x] `already-declared` and `already-wired` for a `b` of another type: cat's untyped self `b` (DS5), mouse's inherit `b` (WS5).
- [x] A second, different wire target sits beside the first: lamp ends with three (WS2, WS9).
- [x] An naddr target gives the same `b` as its address, and no naddr is stored (WS4).
- [x] A `REFERENCES {source:'b-tag'}` from an import isn't doubled (DS7, WS8); one with another source isn't matched (WS8).
- [x] A placeholder is made only when no node of any label is at the address: dog house has no `NostrEvent` label (WS3); a second wire reuses the first's placeholder (WS3).
- [x] A placeholder is import nostr's kind: `NostrEvent` and `TapestryNode` only, `kind`, `pubkey`, a key, no `created_at`, no `id` (WS2).
- [x] Other tags and the JSON stay; nothing else in the graph changes (DS2, WS9, DF6).
- [x] `letterOutOfDate` is true only for a lettered header, and false on a repeat (DS1, DS4, DS5, WS1, WS7, DF1, DF3).
- [x] Nothing is signed or sent, paired with a check that the calls ran (DS11, WS14, DF9).
- [x] A malformed `b` is no real `b`: goal is deferred, its malformed `b` kept (DF4).
- [x] A target held only by a placeholder an earlier call made: `held: false`, `node` that placeholder's key, no second node (WS3, Amendment 1 item 1). So is seed-firmware's kind, a `TapestryNode` with no `created_at` (WS3).
- [x] A repeat whose `b` names an address with no node, as a route that draws no relationship writes one: `node: null`, `held: false`, nothing written, nothing drawn (WS17, Amendment 1 item 3).
- [x] `bValues` sorted (WS2, WS8, DF4) and distinct (DF2's two markers), read after the call (Amendment 1 item 2).
- [x] The order of the checks, each pair that can meet (WS18, DS8, DF7; Amendment 1 item 4).

## Test infrastructure

- **Test framework:** Node's own runner, each suite's `run()`, through `test/operations.test.js`.
- **Concept Graph API:** none. Every suite is stack-free; the live check is the Implementer's, on a scratch stack.
- **Firmware state:** the seeds hold what an install leaves. `test/helpers/conceptGraph.js` holds twelve firmware concepts and `exportFixtures.js`'s world holds fourteen. No `POST /api/firmware/install` precondition.
- **Fixtures:** `test/helpers/sharingGraph.js` (new): story 16's seed with the `b` tags and relationships the three suites need, built once a process and held in memory. For Amendment 1 it also holds:
  - gong, whose `b` names an address with no node;
  - seed-firmware's kind of placeholder at NEWT, with flute to wire to it;
  - two widgets holding a real `b`, one naming relay and one naming its own address.

  Its header says what each concept holds. The export cases use `exportFixtures.js`'s world (pet, animal and bird); the agent suite uses its `firmwareOnly`.
- **The fake.** Nothing was taught to a fake. A probe on 2026-11-21 showed that `test/helpers/graphFake.js` can't run the self-loop's `MERGE (h)-[r:REFERENCES {source: 'b-tag'}]->(h)` ("a MERGE it can't read"). The Cypher engine runs it, made once. It also runs an `OPTIONAL MATCH` of a node of any label, and import nostr's placeholder `CREATE … SET p.kind = toInteger(…)` with `keyNode`. A second `NostrEvent` at the same address fails the uniqueness rule, as it would on Neo4j. So the three suites run on the Cypher engine, as import's and export's do.

### For the Implementer

- **What the answers are read as:** `outcome`; `concept.conceptHeader` and `concept.address`; `disposition.selfDeclared`, `disposition.wired`, `disposition.deferred` and `disposition.bValues`; `letterOutOfDate`; `change` (the entry, or null); and for wire-to-shared, `target.address`, `target.held` and `target.node`.
- **`disposition.bValues`** (Amendment 1 item 2) is compared exactly: the header's `b` values after the call, as strings, once each and sorted with JavaScript's default sort.
- **`target`** (Amendment 1 items 1 and 3), on a first call and on a repeat alike:
  - `held` is true only when a node that isn't a placeholder (it has a `created_at`) is at the address;
  - `node` is the key of the node there, the placeholder included, or null when no node is there;
  - a repeat reads both from the graph and writes nothing.
- **Changes are compared exactly,** as multisets: `{ change: 'tag-added', node, field: 'b', now }`, `{ change: 'tag-removed', node, field: 'b', was: 'b-tag-deferred' }` and `{ change: 'relationship-added', type: 'REFERENCES', from, to }`, with no other field.
- **The words the suites read** (Amendment 1 item 6):
  - `not-own-concept`: relay's says "another author"; recipe's says "owner".
  - `self-target`: names `graph declare-shared`.
  - `bad-target`: names the input, `input: 'target'`.
  - `not-installed`: names `concept-header`.
- **`target`'s input schema** (Amendment 1 item 5) is `{ type: 'string', maxLength: 2048 }`, with no `pattern`. The operation's own `targetOf` refuses each bad form `bad-target` (WS10).
- **The order of the checks** (Amendment 1 item 4).
  - In wire-to-shared, the target's form is checked in `apply` before any statement. WS18 counts the run's transactions that rolled back with no statement: there must be exactly as many as its bad-target calls, nine, and one on the not-installed graph.
  - Then come the locks, the header's refusals, `self-target`, the repeat, and the write.
  - declare-shared and defer-sharing take the locks, then the header's refusals, then `affiliated` (defer-sharing only), then the repeat.
- **Each declares only the refusals it can answer:** declare-shared lists none of `bad-target`, `self-target` and `affiliated`, and defer-sharing lists neither of wire's two.
- **The lock tests** mark the first statement that writes with the concept's key among its parameters, using the Cypher fake's `failures.meanwhile` with nothing to add. They need K.lock's statement first, with nothing between it and that write. `S.lockNode`'s text isn't pinned.
- **"Nothing else changed" (DS2, WS9, DF6)** compares the whole graph before and after a run. It allows only these differences, on the headers written: their `b` tag nodes and those `HAS_TAG` links, their `REFERENCES {source:'b-tag'}`, placeholders, and change entries. Any other node property or tag that changes fails it.
- **`micromark` is installed now.** At first this worktree's `node_modules` dated from 2026-11-13, before story 34 added `micromark` 4.0.2. Export nostr couldn't load, and 48 of export's existing tests failed on today's code. The coordinator ran `npm ci` in the worktree on 2026-11-21, and those 48 pass now.

## How to run

Never the full `npm test` on this Mac: the container named `tapestry` is the owner's agent-memory instance. Run `test/operations.test.js` alone, which runs every suite under `test/operations/`; never run those suites in the same process too. Run it through the session's wrapper, which stubs `curl` and `docker` first on `PATH`, points `BRAINSTORM_CONF_PATH` at a dead conf, sets dead endpoints and unsets `TAPESTRY_CONTAINER`:

```
safe-run.sh -e "require('./test/operations.test.js').run().then((r) => { console.log('RESULT ' + JSON.stringify({ pass: r.pass, fail: r.fail, skipped: r.skipped })); process.exit(0); })"
```

A suite alone: `safe-run.sh test/operations/graph/declare-shared.test.js`.

## The live check (AC5, at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

As ADR 0048's Implementation notes give it:
1. An admin agent, through the external CLI, makes a concept.
2. It declares that concept shared, and wires a second concept to it.
3. It runs export nostr with `dryRun`, then for real, to the stack's own relay.
4. It reads the letters back from that relay by id. The header carries the self-pointing `b`, and the wired concept's elements carry the stamp.

The first use on david.tapestry.ninja waits for the owner's yes.

## Raised at Test Design

Each was put to the Architect and is answered by ADR 0048's Amendment 1 (2026-11-21, ratified by the owner at this gate). The suites now pin each answer.
1. **`target.held` for a placeholder that is already there.** Decision 7 said `held` is false "when a placeholder was made", which left open a target holding only an earlier call's placeholder. **Answered by Amendment 1 item 1:** `held` is true only when a node that isn't a placeholder (one with no `created_at`) is at the address. So kite wired to FISH after lamp's call answers `held: false`, `node` that placeholder's key, with no second node. WS3 pins it, and the same for seed-firmware's kind of placeholder.
2. **The field for `disposition`'s `b` values.** Decision 7 named no field, and the suites accepted four names. **Answered by Amendment 1 item 2:** `disposition.bValues`, the `b` values as strings, once each and sorted, read after the call. The four-name tolerance is gone, and the suites pin that one field exactly.
3. **`target` on `already-wired`.** Decision 7 didn't say what a repeat answers in `target`. **Answered by Amendment 1 item 3:** `{ address, held, node }`, read from the graph as a first call answers it, writing nothing. `node` is null when no node is at the address. WS4 and WS5 pin the repeat, and WS17 the `null`, with nothing drawn.
4. **The order of wire-to-shared's checks.** A bad target on an unknown, another author's or firmware concept could have answered either refusal. **Answered by Amendment 1 item 4,** which orders all three operations' checks. WS18, DS8 and DF7 pin each pair that can meet. Amendment 1 item 5 adds the input's schema: a string, `maxLength` 2048, no `pattern` (WS16).
5. **Two existing tests move.** MF15 and EN29 pinned "At a glance (62 operations)" and now ask for 65, failing until the catalog changes, as at story 19. **Answered by Amendment 1 item 7,** which records the move.
6. **The words pinned.** The suites read "another author" and "owner" in `not-own-concept`, and "declare-shared" in `self-target`. **Answered by Amendment 1 item 6:** those, with `self-target` naming `graph declare-shared` and `not-installed` the concept-header concept. WS11, DS9, WS12 and DF7 pin it.

## Added at Implementation (the Tester's lane)

**One kept lookup.** `test/operations/lifecycle/tapestry-key-paths.test.js` (G11, G18) wants every source line that names `:NostrEvent` alone to be listed, with its reason, in `test/operations/lifecycle/nostr-event-lookups-kept.json`. The placeholder ADR 0048 Decision 6 prescribes, `CREATE (p:NostrEvent {uuid: $uuid})` in `src/operations/catalog/graph/_dispositions.js`, is such a line. Test Design missed it, since the line didn't exist yet.

The entry sits after import nostr's identical placeholder, and gives the reason: a `CREATE` can't take a label disjunction, and it runs only when the same transaction's lookup by `NostrEvent|TapestryNode` found no node there. Stories 32 and 44 added their entries the same way. It is a commit of its own, apart from the implementation's.

## Added at review round 1's findings

Review round 1 (`engineering-team/reviews/graph-operations-first-slice/48-declare-a-concept-shared.md`) passed with five non-blocking findings. The owner chose to fix them before the pull request, so their tests come first. ADR 0048's Amendment 2 answers the findings, and these tests pin it.

| Test | Amendment 2 | What it pins | File |
|---|---|---|---|
| **WS19** (new) | item 1 (finding 1) | add-relationship asked for `REFERENCES` is refused 409 `reserved-type` by `relationship-type-allowed`. Its words name `import nostr`, `graph declare-shared` and `wire-to-shared`, and nothing is drawn. EN28 pins `ENUMERATES`' makers the same way | `test/operations/graph/wire-to-shared.test.js` |
| **WS20** (new) | item 2 (finding 4), with its sub-item "The MERGE adopts first" | An import's `NostrEvent`, with a `created_at`, is committed at RACE between `nodeAt`'s read and the placeholder's write. It is matched, not refused: the wire answers `wired` and commits, its `REFERENCES {source:'b-tag'}` runs to that node, and no second node is at RACE. `target.held` is true and `target.node` is that node's key, both read from the merged node. A placeholder the write makes itself, at FRESH, is still import nostr's: `NostrEvent` and `TapestryNode`, `kind`, `pubkey`, a key, no `created_at`, no `id`. **The adoption:** the adoption statement runs right before each of the run's three placeholder statements (RACE, RACE2, FRESH). It runs only when `nodeAt` found no node: not for a wire to relay's header. An event-less node, seed-firmware's kind, committed at RACE2 just before the adoption statement is adopted. So the `MERGE` lands on it, with one node there, now with import nostr's labels; `held` is false and `node` is its key | the same |
| **G11**, **G18** (their registry changed) | item 2 | The kept entry for wire-to-shared's placeholder now names the `MERGE` line, `` const PLACEHOLDER = `MERGE (p:NostrEvent {uuid: $uuid}) ``. Its reason says it is a `MERGE` now, which matches a `NostrEvent` committed meanwhile instead of failing the uniqueness rule. The two adoption lines get entries of their own, with `importEventDirect`'s reason (ADR graph-operations-foundation/0003, Decision 9), which G9 asks for. All three fail until the lines in the code read so | `test/operations/lifecycle/nostr-event-lookups-kept.json` |
| **G9** (unchanged) | item 2, "The MERGE adopts first" | Every `MERGE` of a `NostrEvent` by its address adopts an event-less node first. It passes today, since the placeholder is a `CREATE`. It passes again once the `MERGE` lands with `ADOPT` right before it | `test/operations/lifecycle/tapestry-key-paths.test.js` |
| **DS14** (unchanged) | item 3 (findings 2 and 3) | It pins only that BIBLE §25 and inherit-from.md name the three operations, not the wording item 3 changes, so nothing moves. No test pins the new wording; the Reviewer reads it | `test/operations/graph/declare-shared.test.js` |
| **WS3** (unchanged) | item 2, "why `nodeAt` still runs first" | Nodes at an address without the `NostrEvent` label are found, and no second node is made there: dog house's header and seed-firmware's placeholder at NEWT. A `MERGE` on `NostrEvent` alone, with no `nodeAt`, would fail it | the same |

Item 4, the second live check (LH2), is the Implementer's, on a scratch stack.

**The fake learned one thing.** A `failures.meanwhile` entry of `test/helpers/cypherGraphFake.js` may now carry `query`, the source of a regular expression. The entry then fires only at a statement whose text, on one line, matches it too. Entries without it fire as before.
- **Why it's needed:** wire-to-shared writes the header's `b`, whose value is the address, before `nodeAt` reads. An entry matched on the address alone would fire at that write, before the read. `nodeAt` would then find the node, no placeholder statement would run, and WS20 would pass on today's `CREATE`.
- **The pattern WS20 uses:** a `NostrEvent` named by its `uuid`. It matches Decision 6's `CREATE` and Amendment 2's `MERGE` alike, and neither the `b` tag's `NostrEventTag` nor K.lock's disjunction.

**A second `meanwhile` entry.** RACE2's matches the adoption statement's text, a `TapestryNode` named by its `uuid` with `WHERE NOT x:NostrEvent SET x:NostrEvent`. So its event-less node arrives after `nodeAt`'s read and before the adoption, the window the adoption closes. With no adoption statement it never fires, and WS20 fails, naming the adoption it wants before each placeholder.

**A run of its own.** WS19 and WS20 share a third harness run over their own copy of the graph, for two reasons:
- add-relationship's guard refuses `REFERENCES` without reading the graph, so its transaction runs no statement, and WS18 counts the main run's transactions that run none;
- the import's node at RACE would trip WS9's "nothing else changed".

**Checked against Amendment 2's code, in a scratch copy.** A copy of the tree had item 1 applied (`FIRMWARE_MADE.REFERENCES`) and item 2 applied (the `MERGE`, with `held` and `node` read from the merged node). The copy was never in this worktree. In it:
- WS1–WS20, G11 and G18 pass;
- so do declare-shared, defer-sharing, the export cases, add-relationship, remove-relationship, relationship-type-allowed, the write path, enumerate, move-element and memberships-shared.

**Raised for the Architect, and answered: G9 failed under item 2's first `MERGE`.**
- **The rule:** G9 (`test/operations/lifecycle/tapestry-key-paths.test.js`, story graph-operations-foundation #3, ADR 0003 Decision 9) holds every `MERGE` of a `NostrEvent` by its address, outside `eventSync.js`, to adopt an event-less node there first.
- **What the copy showed:** with `nodeAt` ahead of the `MERGE` but no adoption, G9 answered "`_dispositions.js:154`: MERGE of a NostrEvent by its address with no adoption before it".
- **The answer:** Amendment 2 item 2's sub-item "The MERGE adopts first" takes way (a). Right before the placeholder, `_dispositions.js` holds `` const ADOPT = `MATCH (x:TapestryNode {uuid: $uuid}) WHERE NOT x:NostrEvent `` and `` SET x:NostrEvent`; ``, which `drawReference` runs, then the `MERGE`, only when `nodeAt` found no node. G9 stays as it is.

**The adoption entries name whole lines.** G11 counts an entry stale unless its `text` equals a source line, trimmed. In `_dispositions.js` the adoption's two lines also carry `` const ADOPT = ` `` and the closing `` `; ``. So the entries are those whole lines, not the bare statement lines that `helpers.js`' and `index.js`' entries list. In the copy, the bare texts left G11 (stale) and G18 (two lines unlisted) failing, and the whole lines pass.

**Checked again, with `ADOPT`.** The copy then had `ADOPT` too, exactly as the amendment gives it.
- WS1–WS20 pass, and so do G9, G11 and G18, with all 20 of `tapestry-key-paths`.
- With the adoption call taken back out, WS20 fails, naming the adoption statement it wants before each placeholder.

## Verification

**At review round 1's findings** (2026-11-21, at `c23552a8f`, the review's commit). The implementation had landed. ADR 0048's Amendment 2 and this round's test files were uncommitted beside it. `test/operations.test.js` ran alone through the same wrapper:

```
operations: 1552 passed, 4 failed, 20 skipped
```

The four fail for want of what Amendment 2 builds, and every other test passes:

```
  WS19: the refusal names its makers … ; got "REFERENCES is reserved: it is made by import nostr, with the checks it needs. …"
  WS20: race must answer 200; got 500 "graph wire-to-shared failed: Node(…) already exists with label `NostrEvent` and property `uuid` = '39998:bebe…:race'"
  G11:  kept entries are stale: the ADOPT lines and const PLACEHOLDER = `MERGE (p:NostrEvent {uuid: $uuid}) name no line of _dispositions.js yet
  G18:  _dispositions.js:154 const PLACEHOLDER = `CREATE (p:NostrEvent {uuid: … names only NostrEvent and isn't listed
```

That is the run after the adoption's pins too (WS20's second race, the order, and the two `ADOPT` entries): the same four, and G9 passes. With Amendment 2's code applied in a scratch copy, `ADOPT` included, the four pass, and so do G9 and all of `tapestry-key-paths`.

**At Test Design** (the rounds before the implementation landed):

The new tests fail with the current code, each for want of what the story builds. Confirmed on 2026-11-21 on `A10.44-declare-shared-concept` at `cc3715f08` (the ADR's commit), with this phase's files and ADR 0048's Amendment 1 uncommitted beside it, and `micromark` installed (`npm ci`). `test/operations.test.js` ran alone through the session's wrapper (stubs first on `PATH`, a dead conf, dead endpoints, `TAPESTRY_CONTAINER` unset):

```
before Amendment 1's pins (the coordinator's run):  operations: 1502 passed, 50 failed, 20 skipped
after them:                                         operations: 1502 passed, 52 failed, 20 skipped
```

The 52 failures are the 50 new tests, and MF15 and EN29:

```
  DS1–DS14, DF5, EB1–EB6, XS1:
        src/operations/catalog/graph/declare-shared.js does not exist yet (ADR graph-operations-first-slice/0048 Decision 1)
  WS1–WS18:
        src/operations/catalog/graph/wire-to-shared.js does not exist yet (ADR graph-operations-first-slice/0048 Decision 1)
  DF1–DF4, DF6–DF11:
        src/operations/catalog/graph/defer-sharing.js does not exist yet (ADR graph-operations-first-slice/0048 Decision 1)
  MF15: the catalog's "At a glance" counts 65 operations
  EN29: "At a glance" counts 65 operations
```

Every suite that passed before passes now, but MF15 and EN29. The first run here, before `npm ci`, gave 1454 passed, 98 failed, 20 skipped. 48 of those failures were export nostr's, for want of `micromark`.

**Each test gets past its declaration check.** A copy of the tree in the session's scratchpad ran the five new suites against a throwaway stub of the three operations, written as ADR 0048 and its Amendment 1 describe them. Its `node_modules` was `A10.34`'s, which has the same dependencies. The stub was never in this worktree.
- 49 of the 50 new tests passed. DS14 failed, since the stub wrote no docs.
- The first stub run found three faults in the tests, since fixed. Each was a "nothing was written for it" check that also counted the setup's `create-concept` entries, or an entry naming relay as another wiring's target. `changedSince` now reads only the run's own changes to the node.

**The tests bite.** Each fault put into the stub failed the tests it should. The first six:
- reads before the locks: DS12, WS15 and DF10;
- the marker kept: DS6, WS6 and DF5;
- `CREATE` for the `MERGE`: DS7 and WS8;
- the `MERGE` without its `source`: DS1, DS2, WS1, WS8 and more;
- no repeat check in declare-shared: DS5, with DS1–DS3;
- a placeholder made even where a node is: WS3. The uniqueness rule then fails eleven of wire's tests and seven of declare's.

Amendment 1's ten:
- `held` as "this call made a placeholder": WS3;
- the target's form checked after the locks: WS18;
- `affiliated` before the header's refusals: DF7;
- the repeat read before `not-own-concept`: DS8, and WS18;
- a repeat's `target` answered `node: null`: WS4 and WS5;
- `bValues` unsorted: WS2, WS8 and DF4;
- `bValues` not distinct: DF2;
- a `pattern` on `target`'s schema: WS10, WS16 and WS18;
- `self-target`'s old words, without "graph": WS11;
- a repeat that draws the relationship: WS5, WS9 and WS17.
