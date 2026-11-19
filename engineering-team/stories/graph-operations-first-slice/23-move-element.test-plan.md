# Test Plan: Story 23 — `graph move-element`

**Story:** `engineering-team/stories/graph-operations-first-slice/23-move-element.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0023-move-element.md` (accepted, Option A)
**Date:** 2026-11-18

Both suites are stack-free:
- each runs the real catalog over the fake graph (`test/helpers/graphFake.js`): the move suite in a child process (`test/helpers/operationsHarness.js`), the agent suite behind `test/helpers/externalCliServer.js`;
- every service endpoint is dead;
- the harness's spy watches everything that signs or reads a key.

Both live under `test/operations/`, where `test/operations.test.js` finds and runs them, so neither needs a line in `test/registry.js`.

The declaration-level suites need no edit either. Each reads the catalog itself, so move-element joins it as soon as its declaration exists:
- the listing and `/docs` (`withOperationDocs`), with openapi-coverage's comparison;
- the route table;
- the internal CLI;
- the external CLI's command list.

The stack-free suites can't reach five things, which the live check covers on a scratch stack (below):
- Neo4j's own locking, two calls truly at once;
- a firmware reinstall, with its passes 1d, 1e and wire-implicit-elements;
- a restore on a fresh instance;
- nginx;
- the relay.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: move an element | **ME1** filing (superset → set): `moved`, the answer's node, `from`, `to`, `concept`, `kept`, `concepts`; directly in `to` and not in `from`; JSON and node properties unchanged; one `n` added with a new uuid. **ME2** the entry (`membership-removed`, `membership-added`, `tag-added`, nothing else); history by node, `from`, `to` and concept; `list-elements` with `set` and `direct`. **ME4** back up to the superset. **ME5** set to set. **ME15** the move's concept (innermost, then lowest key). **ME16** marks unchanged. **ME17** every move: links, `n` tags, JSON and properties change only as the move says. **ME18** nothing signed. **ME20** one transaction holds the delete, the `MERGE` and the entry | `test/operations/graph/move-element.test.js` | integration (fake) |
| AC2: safe to repeat | **ME3** `already-moved`, `change: null`, no letters, flags false; also for a node already in `to` that never moved. **ME7** both sets: only `from`'s link goes, no link added; history by node, `from` and concept (amendment 4). **ME8** both sets with the superset as `from`. **ME20** a repeat writes only its lock. **ME21** two moves of one node at once, same `to`: `already-moved`. **ME22** different `to`: `not-in-from`, naming where the first put it. **ME23** a move beside a remove-from-concept. **ME24** another write takes `from`'s link out before the delete (Decision 8). **L5** (live) | `move-element.test.js`; live | integration (fake); live |
| AC3: two sets of one concept | **ME36**: `different-concepts`, naming `to`, each set's concepts and the way on (add-to-concept, then remove-from-concept, as tapestryKeys). Also covered: two sets sharing only word; a `from` in word alone (no remove step); a `to` in graphContext alone; and `different-concepts` answering before the repeat. **ME14** word never counts as the shared concept. **ME43** nothing changed or recorded | `move-element.test.js` | integration (fake) |
| AC4: the node's concepts stay the same | **ME40** `leaves-concept`, naming `from`, the concept and the way on; answered before `joins-concept`. **ME41** `joins-concept`, naming `to`, the concept and the way on ("then make this call again"). **ME13** a concept that still reaches the node another way isn't left. **ME14** leaving word, joining word and joining graphContext are each `moved` (amendment 3). **ME17** no section or `wordTypes` written | `move-element.test.js` | integration (fake) |
| AC5: what it refuses | Each refusal of Decision 14, in its order (table below). Each pins its code, status and `input`. **ME43**: the whole refusal run changes nothing, records no entry and signs nothing. **ME44**: the keyless instance's graph is unchanged | `move-element.test.js` | integration (fake) |
| AC6: anyone's node | **ME11** another author's node, kept beside: moved, its letter, tags and properties untouched. Its `z` naming the concept it stays in is no claim. `cacheOutOfDate` is true. **ME12** a person node, a placeholder and firmware's own element. **ME1, ME4–ME7** the instance's own node's `n` tags follow the move. **ME4–ME6, ME8** `letterOutOfDate` and `letters`. **ME17** no tag written on any node kept beside | `move-element.test.js` | integration (fake) |
| AC7: it lasts, and reaches agents | **ME10** the note: nothing signed, and each of the two reinstall sentences (Decision 11) only where it applies. **ME18** the internal command, recorded as `local`. **ME19** listed (no guard, `repeatKey`, three inputs, refusals in order), `/docs`, the description names a reinstall. **ME30** 401, 403, 415; the command's refusal is the route's. **XE1** an admin agent through the external CLI, with no change to it, does the story's sequence. **L1–L9** reinstall, restore, nginx, relay (live) | `move-element.test.js`, `test/operations/graph/move-element-agent-through-cli.test.js`; live | integration (fake); live |

### Decision 14's refusals, and the outcomes

| Code (status) | Test | Cases |
|---|---|---|
| `same-set` (400) | **ME31**, **ME44** | `to` is `from`. It answers before `unknown-node` (`node` names no node) and before `not-installed` (no assistant key) |
| `not-installed` (409) | **ME44** | no assistant key; nothing changes |
| `unknown-node` (404) | **ME32**, **ME26** | `node`, `from` and `to` each name no node. A change entry isn't a node. With two bad inputs, the first of node, `from`, `to` is named. A node deleted meanwhile is caught on the write path's second try |
| `tag-node` (409) | **ME33** | a json tag as `node` |
| `made-elsewhere` (409) | **ME34** | a header (update-concept), a superset (link-set), a schema (set-schema), a property (update-property), a set by its concept and a set by its label (link-set), and a rule (rulebook) |
| `not-a-set` (409) | **ME35** | an element and a header as `from`, the header's case naming its superset's key; the same as `to`; a card set with no address |
| `different-concepts` (409) | **ME36** | see AC3 |
| `not-in-from` (409) | **ME37**, **ME22–ME24** | Hopper is in another set (named). Lucky is under the superset only through a set (named). Deep Node is in a set below `from` (named). Whiskers is in no set of the concept: the refusal names add-to-concept with node, concept and `set: to`. Also the races |
| `firmware-membership` (409) | **ME38** | a manifest's edge. An element file's concept the move would leave, refused before `leaves-concept` |
| `author-claim` (409) | **ME39** | Each refusal names the author's key and the tag, and says each point of view decides. For an `n`, it names the next pull of the author's class thread. For a `z` naming a concept left, it names a reinstall, and it answers before `leaves-concept` |
| `leaves-concept` (409) | **ME40** | see AC4 |
| `joins-concept` (409) | **ME41** | see AC4 |
| built-ins (400, 401, 403, 415) | **ME30**, **ME42** | missing, wrong type, unknown input (`concept`) |
| `moved` | ME1, ME2, ME4–ME18 | |
| `already-moved` | ME3, ME20, ME21, ME24, XE1 | |
| a whole failure (500) | **ME25**, **ME27** | An entry that can't be recorded keeps nothing. A tag with no tapestryKey: the error names lifecycle migrate, and the move is rolled back whole |

Also **ME45**: add-relationship's `reserved-type` refusal for `HAS_ELEMENT` names `move-element` among the operations that make it (Decision 15).

## Edge cases

- [x] Every copy of `from`'s link goes; the entry records it once, with `count` (ME9).
- [x] An `n` is added only for a set `to`, never a superset, and only when no `n` names it yet (ME4, ME6, ME7, ME8).
- [x] `letterOutOfDate` is false for a lettered own node when no tag changed (ME8). It is false for a node made here with no letter, though a tag changed (ME1).
- [x] `cacheOutOfDate` is true for a cached node, kept in its json tag (ME5) or beside (ME11).
- [x] Concurrency:
  - the lock comes first, and is the only one: not the header, not `from`, not `to` (ME20);
  - two at once, through the fake's `failures.meanwhile` (ME21, ME22);
  - beside remove-from-concept (ME23);
  - a write that doesn't lock the node, landing before the delete, through the new `failures.beforeRelDelete` (ME24).
- [x] The node deleted while the call waited (ME26). An entry that can't be recorded (ME25).
- [ ] Concept Graph API unavailable: not applicable; every suite is stack-free.

**Not pinned on purpose:**
- The order between `from`'s and `to`'s checks when both are bad in different ways (Decision 2, step 5). Only "the first such input" for `unknown-node` is tested.
- `concepts` on a move that joins or leaves word in this seed, where word doesn't reach every node. Decision 12 says `concepts` "is the same before and after", which holds only where word reaches the node before the move. ME14 asserts only that beagle is there.

## Test infrastructure

- **Runner:** each suite exports `run`. `test/operations.test.js` discovers both.
- **Seed:** `test/helpers/moveElementGraph.js` (new), built on `membershipGraph.js`, which doesn't change. Its header says what each added set and node is for. It adds:
  - nine sets: a second beagle set, a set below a set, sets that share only word or only graphContext, a second pet+gadget set, a gadget-only set, a json-data-type+pet set, and a card set with no address;
  - about twenty-five nodes;
  - a relationship event naming one move's pair;
  - firmware's `string.json` element at its install address.
- **The fake graph:** `failures.beforeRelDelete { drop, add }` (new, documented in its header). Another write that doesn't lock the node commits just before the transaction's first relationship `DELETE`, in the committed graph and the transaction's alike. It fires once. **ME0** tests it: it fires only at a `DELETE` (not a read, a lock or a `DETACH DELETE`), survives a rollback, and names a bad key. Nothing else in the fake changed. Every statement the ADR names is one the sibling suites already run. A probe at test design ran the reads over this seed: E2, M1 (anchor and below), M2, `isElementLink`, `conceptsOfNodes` with `without`, `keptIn`, `kindOf`, `lookedAfterElsewhere` and `firmwareMemberships`. Each gave what the seed's header says.
- **Firmware:** the repo's active firmware, for json-data-type's files and its manifest. No `POST /api/firmware/install` is needed: nothing reads a live graph.
- **Existing tests changed:** none. The story's link to this plan is the one doc edit.
- **Not run here:** the full `npm test`, which on this Mac writes to the agent-memory instance. The PR's CI runs the full gate.

## How to run

Each suite alone, with every endpoint dead, `TAPESTRY_CONTAINER_PORT` unset, and stub `curl` (exit 7) and `docker` (exit 1) first on `PATH`:

```
BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 TAPESTRY_PORT=9 TAPESTRY_INSTANCE=http://127.0.0.1:9 \
MEILI_URL_HOST=http://127.0.0.1:9 NEO4J_URI=bolt://127.0.0.1:9 REDIS_HOST=127.0.0.1 REDIS_PORT=9 TAPESTRY_CONTAINER=no-such-container \
node -e "require('./test/operations/graph/move-element.test.js').run().then(r => { console.log(JSON.stringify({pass:r.pass,fail:r.fail,skipped:r.skipped})); process.exit(0); })"
```

Do the same for `move-element-agent-through-cli.test.js`. Once the code is in, run these beside them, since `relationship-type-allowed.js`, `changes.js` and `_sets.js` change, and the fake gained a failure:
- the fake graph's own suite;
- add-to-concept, remove-from-concept and memberships-shared;
- add-relationship and remove-relationship;
- concept-writes-take-header-lock;
- delete-node, link-set and unlink-set;
- history and list-elements.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

As stories 22, 26 and 28 did, it lives here and in the story's record, not in test code. Check `docker ps` and the shared notes before taking a scratch name, and take the stack down afterwards.

- **L1:** XE1's run through the external CLI, by an admin agent with its own key and no change to the CLI:
  - create-element makes an element in a concept of the owner's that has two sets;
  - the agent files it from the superset into a set, files it again (`already-moved`), and moves it on to the second set;
  - it is refused `different-concepts` and a `from` that doesn't hold the node.
- **L2:** on that concept, a node filed out of its superset, then a firmware reinstall:
  - the node is still in the set, and its concepts are unchanged;
  - record whether pass 1d linked the superset to it again (Decision 11 expects it to, since its `z` names the concept).
- **L3:** a set-to-set move kept through a reinstall: directly in `to`, not in `from`.
- **L4:** a backup restored on a fresh instance: every moved node is directly in `to` and not in `from`, with its `n` tags as moved.
- **L5:** two moves of one node at once, fired from one node process in the container:
  - with the same `to`: one `moved`, one `already-moved`, one entry;
  - with different `to`s: one `moved`, one `not-in-from`.
- **L6:** a peer's lettered node with an `n` naming `from`, made with Cypher: refused `author-claim`.
- **L7:** a firmware element in a manifest's set: refused `firmware-membership`.
- **L8:** through nginx: a visitor gets 401 and a stranger 403.
- **L9:** across L1–L8, the relay's event count is unchanged.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-18, on `A10.23-graph-move-element` at `ae481eb4`, each suite alone with every endpoint dead:

```
=== operations: graph move-element ===
  PASS  ME0 [Decision 8]: the fake's failures.beforeRelDelete fires once, just before the first relationship DELETE, in the committed graph and the transaction's alike
  FAIL  ME1 [AC1, AC6]: filing: Filer goes from beagle's superset into show beagles, in one write; its n naming the set is added; its JSON and the rest stay
        src/operations/catalog/graph/move-element.js does not exist yet (ADR graph-operations-first-slice/0023 Decision 1)
  … the same for ME2–ME27 and ME30–ME45 …
operations: graph move-element: 1 passed, 43 failed, 0 skipped

=== operations: an admin agent moves an element through the external CLI ===
  FAIL  XE1 [AC7]: the agent files an element create-element made, repeats it, moves it on to a second set, is refused different concepts and a from that doesn't hold it, and reads the history back
        src/operations/catalog/graph/move-element.js does not exist yet (ADR graph-operations-first-slice/0023 Decision 1): the external CLI exited 2: 'graph move-element' isn't among the operations npub1… may call on http://127.0.0.1:…: it may not exist there, or it may be the owner's only.
operations: an admin agent moves an element through the external CLI: 0 passed, 1 failed, 0 skipped
```

XE1 fails after the agent's create-element succeeded, so the agent, the server and the seed work.

**Each test gets past the declaration.** A scratchpad copy of the move suite ran with the declaration check turned off (`1 passed, 43 failed`). Every test reached the route or the listing and failed on the missing feature:
- `404 Cannot POST /api/tapestry/graph/move-element`;
- "graph move-element is listed";
- or, for ME45, today's reserved-type words: "made by graph add-to-concept, remove-from-concept and create-element".

None failed in the test code. ME30's 401 and 403 already pass, since route access covers the `/api/tapestry/` prefix; it fails on the 415 and the command.

**A faithful implementation passes them.** Following story 28's practice, a throwaway reference of `move-element.js` was written from the ADR alone. It went into a `git archive` copy of `ae481eb4` in the session's scratchpad, with this phase's tests laid over it, and never entered the repository. It added no export, as Decision 15 requires, and changed `relationship-type-allowed.js`'s words. On it, the move suite passed 44/0 and XE1 1/0.

That run caught one wrong test: ME13 asserted all of Shared Kept's tags unchanged, though a move into a set adds an `n`. The test now asserts its `z` tags unchanged; ME17 checks the `n`.

**The tests bite.** Each wrong edit of the reference below ran on its own, and the file was restored after each:

```
W1  remove-from-concept's reading (links from from and below)  41/3  ME20 ME22 ME37
W2  a header lock, as add-to-concept takes                     43/1  ME20
W3  word counted as a shared concept                           41/3  ME14 ME17 ME36
W4  no tags written                                            36/8  ME1 ME2 ME4 ME5 ME6 ME7 ME17 ME27
W5  tags written for a node kept beside too                    41/3  ME11 ME12 ME17
W6  no author-claim check                                      42/2  ME39 ME43
W7  concepts judged before the claims                          41/3  ME38 ME39 ME40
W8  a delete that finds nothing is ignored                     43/1  ME24
W9  the repeat checked before different-concepts               43/1  ME36
W10 the outermost shared concept                               43/1  ME15
W11 an n for a superset too                                    42/2  ME4 ME17
W12 letterOutOfDate for any lettered own node                  43/1  ME8
W13 joins-concept not checked                                  42/2  ME41 ME43
W14 the node read before the lock                              43/1  ME20
```

**The fake's change breaks nothing.** On the real tree, each suite alone:

| Suite | Passed | Failed |
|---|---|---|
| graph-fake | 31 | 0 |
| concept-writes-take-header-lock | 8 | 0 |
| delete-node | 40 | 0 |
| remove-from-concept | 36 | 0 |
| unlink-set | 21 | 0 |

**Left to Review, not tested:**
- the catalog row, the `changes.js` header sentence and the `_sets.js` header comment;
- the two ledger rows (Decision 15; Consequences 1 and 2).
