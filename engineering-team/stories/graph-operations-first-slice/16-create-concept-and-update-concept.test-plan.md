# Test Plan: Story 16 — `graph create-concept` and `update-concept`

**Story:** `engineering-team/stories/graph-operations-first-slice/16-create-concept-and-update-concept.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0016-create-concept-and-update-concept.md` (with Amendment 1, at Test Design)
**Date:** 2026-11-15

Every suite is stack-free. It runs the real catalog in a child process (`test/helpers/operationsHarness.js`), over the fake graph (`test/helpers/graphFake.js`), with every service endpoint dead, and with the harness's spy on everything that signs or reads a key. The stack-free suites can't reach five things: Neo4j's own locking, the concept-graph routes, a firmware reinstall, a restore, and the relay. The live check covers those on a scratch stack (below).

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — create a concept | CC1 eight nodes, no `NostrEvent`, keyed, named, by role, its entry and the backup note; CC15 nothing signed; CC16 the command | `test/operations/graph/create-concept.test.js` | integration (fake) |
| AC2 — reads like today's | CC2 against today's route itself: addresses, labels, names, tags (plus the `o` tag), the import's tag uuids, JSON, wiring and memberships; CC3 `_fields.js` reads it; CC4 history by any node; **L1** the concept-graph reads | `create-concept.test.js`; live | integration (fake); live |
| AC3 — safe to repeat by slug | CC5 the same name, and other case and spacing, with `differs`; CC18 `differs` names the name (`tea-room` given, `tea room` held); CC6 today's route's and firmware's concepts returned alike; CC13 the lock comes first; **L2** two calls at once make one concept | `create-concept.test.js`; live | integration (fake); live |
| AC4 — near matches | CC7 another author's same slug, own same name, plural swap, the cap of 10 with `moreSimilar`; CC19 the plural swap the other way (a concept whose singular is the plural asked for) | `create-concept.test.js` | integration (fake) |
| AC5 — names | CC11 trim and collapse; `bad-name` for empty, no slug, control, text-direction, 201 characters; 200 is fine; a plural's problem names the plural; `bad-description`. CC11b an invisible formatting character (U+200B), and a Cyrillic name refused for having no letter a–z or digit. CC20 and UC9 a bad input is refused before the rule reads the graph. UC6's `bad-name`. CN2–CN4 the functions | `create-concept.test.js`, `update-concept.test.js`, `concept-names.test.js` | integration (fake); unit |
| AC6 — update | UC1 a rename with no event; UC2 a lettered rename (a hand edit kept, elements still read, `letterOutOfDate`); UC3 a slug (found by it, the old name refused while the key stays, a new concept at a nonce, another author's slug ignored); UC4 a description set and removed; UC5 `unchanged`; UC8 a rename of a concept whose `names` tag has no plural, and the same rename again `unchanged`; CN1 names exactly as today's route derives them | `update-concept.test.js`, `concept-names.test.js` | integration (fake); unit |
| AC7 — refusals and the rule | UC6 `unknown-concept` (twice), `not-own-concept` (another author's, the owner's own key), `firmware-concept`, `name-keyed` (a new plural allowed), `nothing-to-change`, `slug-in-use` naming the concept, a slug that isn't kebab-case; CC8 `key-in-use`; CS1–CS5 the rule as a guard and as a check, and its rules-document entry | `update-concept.test.js`, `create-concept.test.js`, `test/operations/rules/concept-slug-unique.test.js` | integration (fake); unit |
| AC8 — lasts, and reaches agents | CC15 and UC7 401, 403, 415, nothing signed, an admin recorded as the admin; CC16 and UC7 the command; CC17 and UC7 listed with guard, `repeatKey` and refusals, and `/docs`; X3 an admin agent through the external CLI; **L3** a reinstall; **L4** a restore on a fresh stack; **L5** an agent through nginx; **L6** the relay unchanged | `create-concept.test.js`, `update-concept.test.js`, `concepts-agent-through-cli.test.js`; live | integration (fake); live |

## Edge cases

- [x] **A held address.** CC9: the next nonce, `held~1`, with the `d` tag and the `concept-graph` tag following it.
- [x] **Every nonce held.** CC10: `no-free-address`, and nothing is made.
- [x] **No firmware.** CC12: without a concept the nodes join, or without the concept-header concept (the lock's node), it is refused `not-installed`, naming what is missing.
- [x] **The entry can't be written.** CC14: none of the eight nodes is kept (ADR 0004 Decision 3).
- [x] **Inputs.** CC17: missing, of the wrong type, unknown.
- [x] **A hand edit survives a rename** (UC2), **and a value of 200 characters is fine** (CC11).
- [x] **A pre-existing key clash** never blocks an update that doesn't touch it (CS3's items carry the slug alone; Amendment 1.2).
- [x] **The fake's limits.** F15–F20 in `test/operations/graph-fake.test.js` prove the new statements over the fake itself, and the refusals F7 and F14 still hold.
- [x] **A `names` tag with no plural** (review round 1, blocking 1). UC8: the seed's mouse loses its tag's plural, as a header the dlist curation copies can; a rename lands, and the same rename again answers `unchanged`.
- [x] **Which refusal comes first** (review round 1, non-blocking 1). CC20 and UC9: a bad plural, description or name is refused before the rule reads the graph, though the rule would refuse too.
- [x] **Invisible characters in a name** (review round 1, non-blocking 3). CN3: U+200B, U+00AD, and a zero-width joiner beside a Latin letter are refused; a zero-width non-joiner between two Persian letters, which the script needs, is not.
- [ ] **Concurrency, through Neo4j.** The fake has no locks, so L2 shows two creates at once making one concept. CC13 shows only that the lock is taken first. The re-check after the lock is pinned by nothing (review round 1, non-blocking 4): **L7**, below, is for the next scratch run.
- Not derivable from any criterion: **CC2's tag uuids and json text match the route's byte for byte.** That is what makes a later letter, signed from these tags, land on the same nodes.

## Test infrastructure

- **Framework:** Node's own runner, through each suite's `run()`. Every suite under `test/operations/` is found by `test/operations.test.js` (ADR graph-operations-foundation/0001 Decision 12), so nothing is added to `test/registry.js`.
- **The fake graph learns** C1 (the lock, by `NostrEvent|TapestryNode` address), C5 (any node's CREATE), C6 (tags under a node), C11 (a tag's DETACH DELETE), label alternatives, `toLower` in both read fakes, and the four wiring types: `IS_THE_PROPERTIES_SET_FOR`, `IS_THE_PROPERTY_TREE_GRAPH_FOR`, `IS_THE_CORE_GRAPH_FOR` and `IS_THE_CONCEPT_GRAPH_FOR` (Amendment 1.4). The reads C2, C3, C4, C8 and C9 already run on the general read fakes. The Implementer keeps to these shapes: the ADR's Implementation notes, C1–C11.
- **Fixtures:**
  - `test/helpers/conceptGraph.js` seeds the firmware's twelve core-node concepts, and lettered concepts made by today's route itself: beagle with rover and a hand edit (not dog: the firmware has a dog concept, at the address a seeded dog would take), cat with its slug changed, bird renamed, mouse/mice, a name-keyed concept, another author's nostr relay, the owner's own recipe, twelve widgets, a held address and 100 crowded ones.
  - `test/helpers/todaysCreateConcept.js` runs today's `handleCreateConcept` in a sandbox, as AC2's oracle.
- **Firmware state:** none. The seed stands in for the firmware.
- **The concept-graph API at `localhost`:** not used. The local stack on this Mac is the agent-memory instance, not a test one.

## How to run

Run only the suites this story touches, one at a time, with the service endpoints dead. Never run the full `npm test` on this Mac: about 40 suites write to the local instance. The full gate is the pull request's CI run.

```
export NEO4J_URI=bolt://127.0.0.1:9 REDIS_HOST=127.0.0.1 REDIS_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9
node test/operations/graph-fake.test.js
node test/operations/graph/concept-names.test.js
node test/operations/graph/create-concept.test.js
node test/operations/graph/update-concept.test.js
node test/operations/rules/concept-slug-unique.test.js
node test/operations/graph/concepts-agent-through-cli.test.js
```

Re-run as well the suites that share the fake: `graph/{add-relationship,remove-relationship,history,mark-field,unmark-field,map-fields,fields,fields-agent-through-cli,agent-through-cli}`, `write-path`, `change-entry-fields`, `change-indexes` and `rules/{field-mark-allowed,relationship-type-allowed}`. At Implementation, add `lifecycle/tapestry-key-paths` (G4, G11), which reads the new files.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

- **L1** A concept made each way, `POST /api/normalize/create-concept` and `graph create-concept`, read through `/api/concept-graph/summaries`, `node`, `neighbors` and `core-nodes`, compared node by node.
- **L2** Two `graph create-concept` calls for one name at once make one concept and one entry.
- **L3** A firmware reinstall leaves a created concept and a renamed one as they were: nodes, labels, properties (the cache's stamp aside), tags and relationships.
- **L4** A backup, restored on a fresh scratch stack, brings both back with their keys.
- **L5** An admin agent, with its own key, through the instance's nginx and the external CLI: create, create again, rename.
- **L6** The relay holds as many events after every write as before the first.

Asked by review round 1, for the next scratch run that touches concepts (not run in this story):

- **L7** A `graph create-concept` whose key comes into use only when a concurrent `graph update-concept --slug` commits, and two updates giving two concepts one slug at once: each is refused by the re-check after the lock (non-blocking 4).
- **L3 again** A reinstall, to see whether the memberships it keeps depend on the order pass 1e meets the edges (non-blocking 6, ledger `2026-11-15-reinstall-drops-a-supersets-own-membership`).

## Verification

The new tests fail with the current code, and for the right reason: what they test isn't written yet. The fake's own suite and the fourteen suites that share it pass. Confirmed 2026-11-15, on the code at `0b1d2a26` (staging, before any implementation), with this commit's tests:

```
operations: the fake graph: 21 passed, 0 failed, 0 skipped
operations: graph create-concept: 0 passed, 17 failed, 0 skipped
        src/operations/catalog/graph/create-concept.js does not exist yet (ADR graph-operations-first-slice/0016 Decision 7)
operations: graph update-concept: 0 passed, 7 failed, 0 skipped
        src/operations/catalog/graph/create-concept.js does not exist yet (ADR graph-operations-first-slice/0016 Decisions 7 and 9)
operations: rule concept-slug-unique: 0 passed, 5 failed, 0 skipped
        src/operations/rules/concept-slug-unique.js does not exist yet (ADR graph-operations-first-slice/0016 Decision 5)
operations: concept names: 0 passed, 4 failed, 0 skipped
        src/lib/conceptNames.js does not exist yet (ADR graph-operations-first-slice/0016 Decision 2)
operations: an admin agent makes concepts through the external CLI: 0 passed, 1 failed, 0 skipped
        src/operations/catalog/graph/create-concept.js does not exist yet (ADR graph-operations-first-slice/0016 Decisions 7 and 9)

graph/add-relationship 12 passed · graph/remove-relationship 7 · graph/history 8 · graph/mark-field 16 · graph/unmark-field 13
graph/map-fields 12 · graph/fields 8 · graph/fields-agent-through-cli 1 · graph/agent-through-cli 1 · write-path 13
change-entry-fields 3 · change-indexes 3 · rules/field-mark-allowed 14 · rules/relationship-type-allowed 10 — 0 failed in each
```

A harness run over the seed answers today's 404 for the route, and "Unknown operation 'graph create-concept'" for the command, so the harness and the seed work before the code exists.

### The live check (Implementation, 2026-11-15)

Run on the Mac Studio, on throwaway instances from `scripts/scratch-stack.sh`, one at a time, booted from image `agent-memory-tapestry` (staging `09dc9b7b`'s firmware and `tapestry` command) with this branch's `src/` mounted. Each had its own assistant key and no published ports, ran `lifecycle migrate --migration tapestry-keys` first, and was removed afterwards. Every call went through `docker exec` to `127.0.0.1:7778`, a direct-local caller, except the agent's, which went through the instance's own nginx.

1. **L1, a concept made each way (AC1, AC2).**
   - `POST /api/normalize/create-concept` made tea house and signed 8 events: the relay went from 450 to 458.
   - `graph create-concept` made coffee house.
   - `summaries` lists coffee house: 0 elements, 1 set, 1 property, labels `TapestryNode`, `ListHeader` and `ConceptHeader`.
   - `node` gives its tags: `names`, `concept-graph`, `d`, `slug` and `json`.
   - `neighbors` gives `HAS_ELEMENT` and the seven wiring types.
   - `core-nodes` for coffee house and tea house: all eight nodes identical once the names are swapped.
2. **L1, the repeat (AC3).** `graph create-concept` for tea house answered `already-exists`, `hasLetter` true, `change` null.
3. **L2, two creates at once (AC3).** Two `graph create-concept` calls for moth, sent in parallel:
   - one answered `created`, with its entry, and one `already-exists`, with the same header key;
   - the graph then held one header at `39998:<TA>:moth` and one entry.
4. **Updates on the instance (AC6, AC7).**
   - lamp renamed light/lights answered `updated` with `name` and `plural` and `core-nodes-renamed`, and `letterOutOfDate` false.
   - A description on the lettered tea house answered `updated`, `letterOutOfDate` true.
   - The same calls again answered `unchanged`, and creating lamp again answered `already-exists` with the concept now named light.
5. **L3, a reinstall (AC8).**
   - **First run, with Decision 3's wiring.** Every node and tag was unchanged, but 11 of each new concept's 21 memberships were pruned: `word` everywhere, `graph` on the graph nodes, `set` on the properties set. A second reinstall changed nothing more.
   - **Tea house, made by today's route,** gained `property`, `concept-header` and `set` memberships, and lost `superset-superset → tea-house-superset`. Its superset then isn't reached by the superset concept's class thread, which is ledger `2026-11-15-reinstall-drops-a-supersets-own-membership`.
   - **Re-check with Amendment 2's wiring** (10 memberships), on a fresh instance. A reinstall (69 s) left coffee house, created, and light, created and then renamed with a description, unchanged: nodes, tags and relationships. Every concept each node's `z` tags name still reached it through its class thread.
6. **L4, a restore on a fresh instance (AC8).**
   - `tapestry lifecycle backup` took the graph offline for 18.2 s, and `download-backup` gave a 4.75 MB tar of its five files. The instance was then removed.
   - On a fresh instance, with its own new assistant, `upload-backup` held it (`sameInstance` false), and `restore` took the graph offline for 21.9 s.
   - Afterwards the instance answered as the backup's assistant.
   - The five concepts (coffee house, light, moth, tea house and the agent's desk lamp) had the same tapestryKeys, nodes with their properties, tags and relationships as at the backup.
   - The backup file, which held the throwaway assistant's key, was deleted.
7. **L5, an admin agent (AC8).** A throwaway key was made inside the instance and listed in `adminPubkeys`. It drove `clients/cli`, copied in, through `http://127.0.0.1:80`:
   - create reading lamp, `created`, recorded as `admin` with its pubkey;
   - create it again, `already-exists`, with no entry;
   - rename it desk lamp/desk lamps, `updated`, recorded as the agent's;
   - `graph history --node <it>`: the update, then the create, newest first.

   A visitor through nginx got 401. A text/plain body got 415, telling it to send JSON.
8. **L6, the relay (AC8).** It held 458 events after today's route, and 458 after every later graph write, the backup included. In the re-check it held 450 before and after. No graph operation sent an event.

### The touched suites (Implementation, 2026-11-15)

`test/operations.test.js`, the whole stack-free operations gate, every suite under `test/operations/` included: **377 passed, 0 failed**. The worktree's `node_modules` is linked to the main checkout's, so that `test/helpers/routeWalk.js` finds express at its absolute path; without the link, W1, X1 and X2 fail on "Cannot find module express", before anything of this story runs.

### The Tester correction for review round 1 (2026-11-15)

On the code at `52ca6e8a` (the review), with this correction's tests and dead endpoints: concept names 3/1 (CN3: a zero-width space passes), create-concept 19/2 (CC11b: the zero-width name is created; CC20: the bad plural answers `key-in-use`), update-concept 7/2 (UC8: the same rename again answers `updated` and records another entry; UC9: the bad name answers `slug-in-use`). CC18 and CC19 pass already: they pin what the review's probe saw work, which no suite covered. The text-direction literals in `create-concept.test.js` and `concept-names.test.js` are `\u` escapes, and a scan of `src/` and `test/` by code point finds U+202A–U+202E and U+2066–U+2069 only at `test/dictionary-resync-concept.test.js:253`, which predates this story.
