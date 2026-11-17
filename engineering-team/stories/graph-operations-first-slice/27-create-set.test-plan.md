# Test Plan: Story 27 — `graph create-set`

**Story:** `engineering-team/stories/graph-operations-first-slice/27-create-set.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0027-create-set.md`
**Date:** 2026-11-16

Every suite is stack-free:

- It runs the real catalog in a child process (`test/helpers/operationsHarness.js`), over the fake graph (`test/helpers/graphFake.js`).
- Every service endpoint is dead.
- The harness's spy watches everything that signs or reads a key.

The stack-free suites can't reach five things: Neo4j's own locking (two calls at once), a firmware reinstall, a restore, nginx, and the relay. The live check covers those on a scratch stack (below).

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: make a set | **CS1** one keyed set under beagle's superset, no `NostrEvent`, its name its tapestryValue, no `id`; the answer's set (key, address, name, slug, description, parents, no letter), its `threads`, its `set-created` entry, the backup note. **CS2** today's address (`dtag.childDTag(name, <parent's uuid>)`), the tags `d`, `name`, `z`, `s`, `description` and `json` in order with the import's tag uuids. **CS4** its two links, and nothing else wired. **CS5** `graph history` by the set and by the parent; `graph list-elements` on the set concept and `graph list-relationships` on the parent list it. **CS6** a set under a set. **CS7** `threads` for a set two concepts' class threads reach. **CS9** a name trimmed and collapsed; a description left out or blank; a name of 200 characters. **CS15** nothing signed. | `test/operations/graph/create-set.test.js` | integration (fake) |
| AC2: its JSON and rule 4 | **CS3** the JSON is firmware's set-file shape, keys in Decision 9's order, and fits the set concept's schema, read from firmware's own file; word, which reaches the set concept's superset, is reported as not fitting (`graphContext`) and doesn't stop it. **CS29** a set concept whose schema asks more: `invalid-fields` from `element-fits-schema`, naming `set.color`. **CS30** `no-schema` for a missing schema and one that doesn't parse. **CS33** another concept above the set concept's superset joins `wordTypes` (D10) and `concepts` (with no schema: `fits: null`, saying why). **CS20** `setJson`'s shape. | `create-set.test.js` | integration (fake); unit |
| AC3: safe to repeat | **CS10** `already-exists`, `change: null`, the same set, one node and one entry; `threads` still given; no `concepts`, `copies`, `skipped` or `note`. **CS11** `differs`: the name's case, a description given that differs; a description left out isn't compared. **CS12** found among the parent's direct sets by name alone (Linked In, at the address lap pets gives it, as stored and in another case; review round 1), by name and address both (today's lettered Show Dogs, add-subset's Puppies), or by the address the name gives, nonce or not (Odd Ones!, Nonce Set); the plain address wins (Twin), then the lowest key (Echo). A description given to a set that has none differs with `holds: null` (Odd Ones!), and a repeated set's `parents` are all its parents (Linked In's two). **CS13** no repeat: another author's set (the owner's answer 2), a superset of the name, the name under another parent, a set at the address no longer under the parent and a node at the address (both the next nonce). **CS14** each transaction takes the lock first; the lock is on the parent. **CS20** `setDiffers`. **L5** two calls at once. | `create-set.test.js`; live | integration (fake); unit; live |
| AC4: what it refuses | **CS22** `unknown-node` for a key no node has and for a change entry's. **CS23** `not-a-parent` for an element, a concept header (naming its superset's key: the owner's answer 3), a card set with no address, a node of no concept. **CS24** `bad-name`, six ways. **CS25** `bad-description`. **CS26** `no-free-address`. **CS27** inputs. **CS8** a firmware concept's superset, another author's superset and another author's set each take a set; so does a set no class thread reaches. **CS28** the refusal run changes nothing and records nothing. **CS31** `not-installed`, with no assistant key and with no set concept superset. **CS32** a write whose entry can't be recorded keeps nothing. | `create-set.test.js` | integration (fake) |
| AC5: one reading of a set | **CS34** over thirteen candidate parents, create-set and link-set accept the same seven and refuse the same six, with the same status, code, input and words. **CS20** `_sets.js` exports `requireParent`, `linkUnder`, `setJson`, `setTags`, `findSetRepeat`, `setDiffers` and `describeSet`, the pieces ADR 0027's Implementation notes put there for delete-set and move-element. | `create-set.test.js` | integration (fake); unit |
| AC6: it lasts | **CS4** nothing is wired that a reinstall would judge (one parent link, one registration). **CS33** marks: a mark on the set concept's `slug` reaches the set in the same write as `set_slug`, and the entry records the copy (Decision 12). **L6** reinstall, **L7** restore. | `create-set.test.js`; live | integration (fake); live |
| AC7: it reaches agents | **CS21** 401, 403 and 415, and the command's refusal is the route's. **CS15** an admin's create is the admin's, and the command's is the command's. **CS16** listed with its guard, `repeatKey`, inputs and every refusal, and `/docs`. **CS17** the change fields' descriptions. **CS18** the catalog's §2 row. **CS35** no new module requires a signer. **XS1** an admin agent through the external CLI, with no change to it: a set under beagle's superset, its repeat, a set under that set, a header refused with its superset's key, an element put in the new set with `graph create-element`, and the set's history. **L8** nginx. | `create-set.test.js`, `test/operations/graph/create-set-agent-through-cli.test.js`; live | integration (fake); live |

## Edge cases

- [x] **The lock's target.** CS14 runs the declaration's `apply` over the fake in a child, recording each statement's parameters, since the fake's log keeps none. The first two statements must lock `parent`, for a create and for a refusal (not-a-parent) alike (Decision 5). The fake isn't changed for this.
- [x] **The lock's order.** CS14: in every transaction of the main run, the first two statements are the lock, set and removed, before any read.
- [x] **The entry can't be written.** CS32: the node and its tags aren't kept (ADR 0004 Decision 3).
- [x] **Inputs.** CS27: a missing input, the wrong type, an unknown input, a `parent` that isn't a tapestryKey, and a description of 10,001 characters.
- [x] **A name of 200 characters** is made (CS9); one of 201 is refused (CS24).
- [x] **Card sets.** CS23 and CS34: a node labelled `Set` with no address is refused, as link-set refuses one (ADR 0028 Amendment 3).
- [x] **A set no longer under the parent.** CS13: Moved sits at the address the name and beagle's superset give, but is under lap pets only. It isn't the repeat, and the new set takes `~1`.
- [x] **A superset of the name.** CS13: Hounds, a superset under beagle's superset, isn't the repeat: only sets count. It is labelled `Set` too, as the old concept-graph setup labels by `z` tag, so R7's `NOT s:Superset` is what leaves it out (review round 1).
- [x] **The fake runs the ADR's two new reads.** CS19 runs R6 and R7 as the ADR writes them, against the seed. It passes already.
- [ ] **Two creates at once on Neo4j:** the fake runs one transaction at a time, so this is live check L5.

## Test infrastructure

- **Framework:** Node's own runner, through each suite's `run()`.
  - Every suite under `test/operations/` is found by `test/operations.test.js` (ADR graph-operations-foundation/0001 Decision 12), so `test/registry.js` gains no line.
- **The fake graph needs one change** (the Tester correction below).
  - R6 and R7 run on the path fake as the ADR writes them (CS19).
  - Every other statement create-set uses is one the fake already runs: R1 and R2, the lock's S8 shape, C4, C6, the relationship MERGE, E1 and E2, and `mapNodes`' reads and S8.
  - C5, `makeNode`'s CREATE, ran for every label but `Set` (see below).
  - `pathCypherFake.js` doesn't change. `graphFake.js` changes one line and its header, so a parallel A10.14 or A10.21 edit to it may meet this one.
- **Fixtures:**
  - `test/helpers/createSetGraph.js` (new) starts from story 20's `createElementGraph.js` seed, itself built on story 16's `conceptGraph.js`. Its header says what it adds:
    - the set concept, with firmware's own JSON schema, a primary property with a `slug` field node, and the first set of neo4j properties;
    - word, with firmware's own JSON schema, above the set concept's superset;
    - a parent of each kind;
    - the repeat's near-misses;
    - held and crowded addresses;
    - a probe set for the parity run.

    Options: `mark`, `above`, `strict`, `schema` and `noSetConcept`.
  - `createElementGraph.js`, `conceptGraph.js` and `fieldGraph.js` don't change.
- **Firmware state:** none. The suites read firmware's files (`firmware/versions/v1.0.0/concepts/set/json-schema.json`, `…/word/json-schema.json`) and never install anything.

## How to run

Run only the suites this story touches, one at a time, with the service endpoints dead. Never run the full `npm test` on this Mac: about 40 suites write to the local instance, the live agent-memory instance. The full gate is the pull request's CI run.

```
export NEO4J_URI=bolt://127.0.0.1:9 REDIS_HOST=127.0.0.1 REDIS_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9
node test/operations/graph/create-set.test.js
node test/operations/graph/create-set-agent-through-cli.test.js
```

At Implementation, also re-run the suites that read the files it changes:

- `graph/{link-set,unlink-set,sets-agent-through-cli}`, `rules/class-thread-acyclic` and `rules/set-has-a-parent`, which use `_sets.js`;
- `graph/create-element`, `change-entry-fields` and `write-path`, which use `changes.js`.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

Take the scratch stack only when the shared notes say it is free, and write a line there when you take it and when you take it down. The container is always named `tapestry-scratch`.

- **L1.** Make a concept with `graph create-concept`, a set under its superset, the same call again, and a set under that set. Read them back through `graph list-elements` on the set concept, `graph list-relationships` on each parent, and the concept-graph routes (`/api/concept-graph/node/<handle>/neighbors`).
- **L2.** A concept header as `parent` is refused, with its superset's key.
- **L3.** An element made in the new set with `graph create-element`.
- **L4.** The set's JSON is checked by the real set concept's schema, as installed; its `concepts` names set and word.
- **L5.** Two create-sets of one name under one parent at once (two `docker exec` calls in parallel) make one set and one entry.
- **L6.** A firmware reinstall. For each set: its tags, its JSON, its link from its parent, and its registration under the set concept, compared before and after (Decision 16). If the registration is gone, stop and ask the owner.
- **L7.** A backup, restored on a fresh scratch stack, brings each set back with its key.
- **L8.** An admin agent with its own key, through nginx and the external CLI: create, create again, create under the new set, the header refusal, an element in the set.
- **L9.** The relay holds as many events after every write as before the first.

## Verification

The new tests fail with the current code, and for the right reason: what they test isn't written yet. The one test that passes, CS19, holds the fake to the ADR's two new reads, which it already runs. A throwaway check also confirmed the suites' wiring against what exists today:

- link-set, over CS34's thirteen candidates, accepts seven and refuses six (four `not-a-parent`, two `unknown-node`);
- the AFTER run's three reads answer 200;
- the route answers 404 until create-set exists;
- CS14's recorder captures an `apply`'s statements and its refusal.

Confirmed 2026-11-16 on the code at `e26eb36a` (staging after ADR PR #109, before any implementation), with this commit's tests:

```
operations: graph create-set: 1 passed, 34 failed, 0 skipped
        src/operations/catalog/graph/create-set.js does not exist yet (ADR graph-operations-first-slice/0027 Decision 1)
        PASS  CS19: the fake graph runs R6 and R7 as the ADR writes them, answering as Neo4j would
operations: an admin agent makes sets through the external CLI: 0 passed, 1 failed, 0 skipped
        src/operations/catalog/graph/create-set.js does not exist yet (ADR graph-operations-first-slice/0027 Decision 1): the external CLI exited 2: 'graph create-set' isn't among the operations npub12x… may call on http://127.0.0.1:59645: it may not exist there, or it may be the owner's only.
```

### The Tester correction at Implementation (2026-11-17)

Implementation found what Test Design missed: the fake graph couldn't run `makeNode`'s `CREATE (n:ListItem:Set {…})`.
- **The cause.** Its CREATE reader looked for a SET clause anywhere in the statement, without regard to case, so it took the label `Set` for one ("a SET it can't read").
- **Why Test Design didn't see it.** Every test stopped at the check that `create-set.js` exists, and the wiring check made no node labelled `Set`.
- **The correction.** The owner approved it as a kick-back to the Tester (2026-11-17), as the node-primitives precedent did. `test/helpers/graphFake.js`'s `createEntry` now looks for SET only after the node's pattern, and the fake's header says so. No test's assertions changed.
- **Its reach.** Every suite under `test/operations/` ran with it and with the implementation, through the scoped gate (`test/helpers/gateRunner.js`, label `a1027-create-set`), with the service endpoints dead. The result was PASS: 51 of 51 suites, 620 passed, 0 failed and 4 skipped (`lifecycle/shared-keys`' live checks, which need a scratch container named). create-set's own suite passed 35 of 35, and the agent's 1 of 1.

### The Tester correction for review round 1 (2026-11-17)

Review round 1 found six breaks of the real code that no test caught. One was blocking: no case found a set by its name alone, since every set the tests found by name also sat at the address its name gives. The owner approved the correction (2026-11-17). No code changed.

- **The seed** gains Linked In, an own set under lap pets and under beagle's superset, at the address lap pets gives it. Hounds is labelled `Set` as well as `Superset`.
- **CS12** gains Linked In as stored and in another case, both `already-exists` with its two parents, and Odd Ones! given a description, which differs with `holds: null`. It also checks that no second Linked In is made.
- **CS19** checks that R7 finds Linked In by its name alone, and that Hounds, now labelled `Set`, is left out.
- **CS20**'s other keys come in an order that reversing doesn't sort.

Each break, applied to a full copy of the code (a `git archive` of `92564632`, whose code is `70a1edce`'s, with these tests), one at a time:

| Broken | Caught by |
|---|---|
| none (the baseline) | — (35 passed) |
| R7 without its name match (`_sets.js`) | CS12: rep-linked makes a second Linked In |
| R7's name match made case-sensitive | CS12 |
| R7 without `NOT s:Superset` | CS13: Hounds is taken for the repeat |
| `differs` skips a description when the set has none | CS12: rep-odd-desc |
| a repeat answers `[parent]` as its `parents` (`create-set.js`) | CS12: rep-linked |
| `wordTypes` reversed instead of sorted | CS20 |

### The live check (Implementation, 2026-11-17)

Run on the Mac Studio, on throwaway instances from `scripts/scratch-stack.sh`, one at a time:

- Each was booted from image `agent-memory-tapestry:latest`, with this branch's `src/` mounted.
- Each had its own assistant key and no published ports, and was removed afterwards.
- Every call went through `docker exec` to `127.0.0.1:7778`, a direct-local caller. The agent's alone went through the instance's own nginx.

1. **L1, sets under a concept and under a set (AC1, AC3).** `graph create-concept` made beagle show.
   - **Champions,** under beagle show's superset: `created` at `…:champions-<hash8>`, the address today's create-set gives the name and parent. Its `threads` named beagle show. Its entry was the command's (`local`).
   - **The same call again:** `already-exists`, the same key, nothing differing, `change: null`. Lowercased with another description: `already-exists`, with `differs` naming the name's case and the description it holds.
   - **Puppy Champions,** under Champions: `created`, its parent Champions, in beagle show's class thread.
   - **Reading them back:**
     - `graph list-elements` on the set concept listed both sets;
     - `graph list-relationships` on beagle show's superset listed the link to Champions;
     - `graph history` on Champions gave its own create, Puppy Champions' and Winner's;
     - `/api/concept-graph/node/<Champions>/neighbors` showed `HAS_ELEMENT` with set's superset and Winner, and `IS_A_SUPERSET_OF` with beagle show's superset and Puppy Champions.
2. **L2, a header as parent (AC4).** Beagle show's header: `not-a-parent`, naming its superset's tapestryKey.
3. **L3, an element in the new set.** `graph create-element` made Winner, an element of beagle show, directly in Champions.
4. **L4, the installed schemas (AC2).** Champions' `concepts`: set, which it fits, and word, which it doesn't. Besides `graphContext`, the installed word schema's conditions on `wordTypes` don't match a set's `["word", "set"]`, which firmware's own set files carry too. That is reported, never refused (ADR 0020 Amendment 1).
5. **L5, two at once (AC3).** Two create-sets of Twin Race in parallel: one `created` and one `already-exists`, with the same key. The graph then held one node at the address and one more entry.
6. **L6, a reinstall (AC6; Decision 16).** It took 70 s.
   - Champions, Puppy Champions and Twin Race were unchanged: labels, properties, tags and relationships, `set-superset`'s `HAS_ELEMENT` included. A set's membership in `set` came through the reinstall. By the code (review round 1; ADR 0027 Amendment 1), pass 1e takes it out and Pass 3's `wire-implicit-elements` puts it back from the set's `z` tag. The ledger row `2026-11-15-reinstall-drops-a-supersets-own-membership` records both.
   - Winner, the element create-element made in Champions, gained a direct `HAS_ELEMENT` from beagle show's superset, from pass 1d, since its `z` names beagle show. ADR 0020 Decision 10 expects that, and it isn't create-set's.
7. **L7, a restore on a fresh instance (AC6).**
   - `tapestry lifecycle backup` took the graph offline for 21.2 s, and `download-backup` gave a 3.1 MB tar.
   - On a fresh instance with its own assistant, `upload-backup` held it (`sameInstance` false), and `restore` took the graph offline for 22.6 s. Its counts matched the backup exactly: 3,352 nodes, 3,836 relationships, and the same tapestryKey digest.
   - The instance then answered as the backup's assistant. Champions, Puppy Champions, Twin Race and Winner had the same keys, labels, properties, tags and relationships as before the backup.
   - The tar, which held the throwaway assistant's key, was deleted.
8. **L8, an admin agent (AC7).** A throwaway key was made inside the instance and listed in `adminPubkeys`. It drove `clients/cli`, copied in, through `http://127.0.0.1:80`:
   - Agent Trials, under beagle show's superset: `created`, recorded as `admin` with its pubkey;
   - Agent Trials again: `already-exists`, nothing recorded;
   - Agent Juniors, under Agent Trials: `created`;
   - beagle show's header as parent: refused `not-a-parent`, naming its superset's key, and the CLI exited 1;
   - Agent Winner, made in Agent Trials with `graph create-element`: `created`.

   Agent Trials' history listed the three creates, each the agent's. A visitor through nginx got 401.
9. **L9, the relay.** It held 450 events before the first write and after every later one, the reinstall included. No graph operation sent an event.
