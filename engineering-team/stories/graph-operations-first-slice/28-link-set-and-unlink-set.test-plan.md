# Test Plan: Story 28 — `graph link-set` and `unlink-set`

**Story:** `engineering-team/stories/graph-operations-first-slice/28-link-set-and-unlink-set.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md`
**Date:** 2026-11-15

## Coverage map

Every suite is stack-free and lives under `test/operations/`, where `test/operations.test.js` finds and runs it (ADR graph-operations-foundation/0001 Decision 12), so none needs a line in `test/registry.js`. Each also runs on its own: `node <file>`.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — Link a set | LS1 a set under a second parent: one link, `linked`, the link `{ set, parent }`, the entry (`graph link-set`, the owner's, `[{ change: 'set-linked', type: 'IS_A_SUPERSET_OF', from: <parent>, to: <set> }]`, kept and keyed by both); the set keeps its first parent; both concepts above the parent now reach the set's element and the element of a set below it · LS2 a class link: a concept's superset under another concept's set, and under its superset; the one concept's elements become the other's · LS3 `graph history` finds the entry by the parent and by the set · LS15 an admin's call is the admin's · LS16 nothing is signed or read (the harness spy), paired with LS1's link | `graph/link-set.test.js` | integration (route and command over the fake graph) |
| AC2 — Safe to repeat | LS4 again: `already-linked`, `change: null`, one link, one entry; a repeat of a link a reinstall would prune also answers `already-linked` and is never refused · *two calls at once: the live check, step 8* | `graph/link-set.test.js` | integration; live |
| AC3 — What link-set refuses | LS5 `unknown-node` (404) for `set`, for `parent`, and for a change entry, each naming its input and the key; a non-key is `invalid-input` · LS6 `not-a-set` (409, `input: set`) for an element, a NostrUser and a concept header, whose refusal names its superset's tapestryKey · LS7 `not-a-parent` (409, `input: parent`) for an element and a concept header, naming its superset's key · LS8 `cycle` (409, `rule: class-thread-acyclic`) for a set under itself · LS9 one link down and two, the chain named from the set down to the parent, in order · LS10 across two concepts, five sets named in order · each: no link, no entry · LS20 a trust-pipeline card set (labelled `Set`, no address) is `not-a-set` (409, `input: set`), its words naming a node with no address · LS21 a card set as `parent` is `not-a-parent` (409, `input: parent`), the same way; neither links anything or records an entry (ADR Amendment 3) · CA1–CA7 and CA10 the rule itself | `graph/link-set.test.js`, `rules/class-thread-acyclic.test.js` | integration; unit (the rule) |
| AC4 — Unlink a set | UL1 one of two parents: gone, the other stays, the parent's concept no longer reaches the set's element, `unlinked`, `letters: []`, the entry (`set-unlinked`, no `count` for one copy) · UL2 history by either key · UL3 again: `already-unlinked`, `letters: []`, `change: null`, one entry · UL4 no link from that parent is `already-unlinked`, not `last-parent`: a set under no parent (its would-be `s` still naming that parent), and a set under another · UL5 two copies, `count: 2` · UL6 the instance's own lettered set reports `letters: [{ address: <set uuid>, says: <names the parent's uuid> }]`, signed by the TA and by the owner · UL7 an event-less set whose would-be `s` names the parent reports none · UL15 an admin's call is the admin's · UL16 nothing is signed | `graph/unlink-set.test.js` | integration |
| AC5 — What unlink-set refuses | UL8 `last-parent` (409, `rule: set-has-a-parent`), naming the parent and both ways on (another parent first; `graph delete-set`); the link stays, no entry · UL9 a superset unlinked from its last parent: its concept is no longer a kind of the other, and it stays its concept's superset · UL10 `unknown-node`, `not-a-set` and `not-a-parent` as LS5–LS7 · UL18 an unlink leaves the node's own properties as they were, whether it is made or refused inside `apply` after the lock (`not-a-set`), and the refused call's rolled-back transaction shows it took the lock first (ADR 0028 Amendment 2; Amendment 3, item 1) · UL19 a card set as `set` is `not-a-set`, even one a link puts under a set · UL20 a card set as `parent` is `not-a-parent` · UL21 a card set doesn't count as a parent: a set whose only other incoming link is from one is refused `last-parent` from its one real parent, and stays under it (Amendment 3) · SP1–SP8, SP11 and SP12 the rule itself | `graph/unlink-set.test.js`, `rules/set-has-a-parent.test.js` | integration; unit (the rule) |
| AC6 — The links these operations leave alone | UL11 `firmware-link` (409) for one link of each part of firmware's definition (ADR Decision 6's table: (a) a set file, (b) existing-sets, (c) a concept manifest, (d) a community reference), each naming its own part and lifecycle seed-firmware; the link stays · UL12 a sweep: all 64 class-thread links the active firmware's files make (22 + 26 + 10 + 6) are each refused as their part, and every shipped existing-sets category resolves to a firmware concept · UL13 the owner's own link between two firmware sets is unlinked · UL14 `peer-link` (409) for a peer's lettered set under the parent its `s` tag names, naming its author and that the point of view decides; the owner's own link to the same peer set is unlinked · LS11 the owner's sets under a firmware concept's set and its superset are linked, beside an older redundancy that stays prunable · LS12 `firmware-prunes` (409), shape 1, naming the link and seed-firmware · LS13 shape 2, the set itself was directly under the firmware superset, or a set below it was, naming that earlier link · LS14 both shapes are linked under the owner's own concept and under `property`, a firmware concept whose folder has no manifest.json | `graph/unlink-set.test.js`, `graph/link-set.test.js` | integration |
| AC7 — The two rules, defined once | CA1/SP1 the loader finds each: name, summary, `refuses: true`, one refusal (`cycle` 409; `last-parent` 409) · CA2–CA6 and SP2–SP7 `violations()` as a guard (`{ set, parent }`; `{ set, without }`) · CA7 and SP8 as a check over links and sets already there: each that breaks it, and only those · CA6/SP7 missing and wrong-kind nodes give no finding · SP5 a superset is exempt · CA8/SP9 the class thread anomaly breaks neither · CA9/SP10 each has its entry in docs/GRAPH_RULES.md (any section number), in the six-part format, saying it refuses, with its check and its repair · Amendment 3, a set has an address: CA10 an item with a card set at either end gives no finding, where a walk that took it for a set would find a cycle; SP11 the check reports no card set, under no parent or under one; SP12 a card set is no parent, as a guard (a set whose only other parent is one is `last-parent`) and as a check (a set under only a card set is reported) | `rules/class-thread-acyclic.test.js`, `rules/set-has-a-parent.test.js` | unit (the rule, over the fake graph) |
| AC8 — It lasts, and it reaches agents | LS17/UL16 a visitor 401 and a stranger 403, each told who may call, and neither changes anything: the command, run afterwards, makes that same link (or takes it out) as new · LS19/UL17 listed for an admin: a POST write for the owner and admins, `guards` ([class-thread-acyclic]; [set-has-a-parent]), `repeatKey: ['set', 'parent']`, two required inputs, the refusals with their statuses (each rule's code among them), and the `/docs` entry · LS18/UL16 the internal command works with no sign-in, recorded as `local`, its refusal the route's · X3 an admin agent with its own key, through the external CLI: links a set, links it again, is refused a cycle, unlinks it, is refused its last parent; history reads the two entries back as the agent's · *a reinstall and a restore, and the agent on a real instance: the live check, steps 4–7* | the two operations' suites, `graph/sets-agent-through-cli.test.js` | integration (the real external CLI against a loopback instance); live |

## Edge cases

- [x] **A repeat:** LS4, UL3, and the agent's in X3. It changes nothing, records nothing, and says so.
- [x] **A repeat of a link a reinstall would prune:** LS4. It answers `already-linked` and is never refused (ADR Decision 1, step 3).
- [x] **Every concept above the parent, not only one:** LS1's Indoor pets sits under both Pets and Households, and both reach the new elements.
- [x] **The sets below the linked set:** LS1, Snoopy of Pocket beagles, a set below Beagles.
- [x] **A superset as `set`, and as `parent`:** LS2 (both), UL9.
- [x] **A set under no parent at all,** its would-be `s` tag still naming a parent: UL4 (`already-unlinked`), SP4 and SP8.
- [x] **Two copies of one link,** as an older path could make: UL5.
- [x] **A change entry, a NostrUser and a concept header as inputs:** LS5–LS7, UL10.
- [x] **Letters:** the TA's and the owner's (UL6); an event-less set's would-be tag (UL7); a lettered set whose `s` tag names another parent (UL13); a peer's (UL14).
- [x] **A peer's set the owner linked too:** UL14. The peer's link stays, and the owner's goes.
- [x] **An element above a set,** as an old route could leave: SP6 (it doesn't count as a parent), SP8, CA6.
- [x] **A cycle an old route made:** CA7 finds its three links, and nothing else.
- [x] **A chain longer than twelve:** CA5 (fifteen sets: twelve named, "3 more").
- [x] **The class thread anomaly:** CA8 and SP9, among them a walk that a rule following `HAS_ELEMENT` would get wrong. Every header in the seed is an element of the concept-header concept's superset.
- [x] **A firmware concept with no manifest.json:** LS14 (`property`).
- [x] **An older redundancy unrelated to the new link:** LS11 and LS4.
- [x] **Every link the shipped firmware makes:** UL12.
- [x] **A trust-pipeline card set** (ADR Amendment 3): labelled `Set`, with a tapestryKey and an `observee_pubkey` but no address, as `src/cns/addSetsOfMetricsCards.sh:26` makes one per scored user.
  - As `set` or `parent` of either operation: LS20, LS21, UL19, UL20.
  - Linked under a set, as the link-set before Amendment 3 could do (UL19), and above one (UL20, UL21, SP12).
  - As a rule's item: CA10 and SP11. Where a card set sits between two sets, a walk that took it for a set would find a cycle. CA10's items are chosen so that it would.
  - Its `WOT_METRICS_CARDS` edge from a NostrUser isn't seeded: no test needs it, and the fake's path reads don't run that type.
- [x] **The lock comes before a refusal inside `apply`:** UL18's refused half (`not-a-set`, after the lock in Amendment 3's order). A guard's refusal, such as UL8's `last-parent`, comes before `apply` and takes no lock.
- [ ] **Two writes at once:** two identical link-sets (AC2), two link-sets that would close a two-set cycle, and two unlink-sets that would take a set's last two parents (Decision 9). The harness sends one request at a time and the fake runs one transaction at a time, so these are the live check's step 8. The re-check after the write (Decision 9) agrees with the guard whenever no other writer runs in between, so no stack-free test can reach it. Its rollback path, a refusal thrown in `apply` after the `MERGE`, is the one LS12 and LS13 take.
- [ ] **The graph database not answering:** the write path's 500 `failed`, shown by story 4's W8.
- [ ] **A firmware or peer link that is also the set's last parent:** the guard runs before `apply`, so it is refused `last-parent`, not `firmware-link` or `peer-link`. Not pinned; see "Gaps and questions" below.

## Test infrastructure

- **Runner.** Node's built-in runner, through `test/operations.test.js`, which the gate runs (`test/registry.js`). No new framework.
- **No live API in the gate.** On the Mac Studio, `:7778` is the owner's private agent-memory instance and must not be written to. There, run these suites one at a time with every endpoint dead, and never the full `npm test`. The gate runs in CI on the pull request. The live check runs on a scratch stack at Implementation (below).
- **New helper: `test/helpers/classThreadSeed.js`.** Its header draws each graph. It is named so it can't collide with story 16's seed helper.
  - It builds on graphFake's `emptyState`/`writeState`, with nodes shaped as create-set (lettered, an `s` tag), add-subset (event-less), the pull (a peer's lettered set) and a firmware install make them.
  - `linkSetGraph()`, `unlinkSetGraph()`, `firmwareSweepGraph()`, `ruleGraph()` and `agentGraph()`. Each test's sets are its own, so one request can't change another test's starting point.
  - `firmwareDefinition()` reads `firmware/active` (which is `versions/v1.0.0`), with the harness's TA, and lists the links ADR Decision 6's table names. Today that is 22 (a), 26 (b), 10 (c) and 6 (d). `categoryToSlug` is copied from `src/firmware/install.js:123`, as the ADR copies it.
  - `addFirmware(b, { concepts, pruned })` seeds firmware's class threads. With `pruned`, it applies install's prune: a link from the superset of a concept with a manifest.json to a child already below it through another child goes.
  - Owner concepts use slugs no firmware concept has. `dog` is a firmware concept with a manifest.json, so it isn't used.
  - `cardSet(name)` makes a trust-pipeline card set: `Set` and `SetOfNostrUserWotMetricsCards`, a tapestryKey and an `observee_pubkey`, no `uuid` and no name (Amendment 3). A class-thread link to or from one is seeded only where a test says so.
  - Part (c) resolves set files only (Amendment 3, item 3). For v1.0.0 nothing changes: all ten edges link a set to a set.
  - The curator's key in part (d) is read from the manifest, never written in.
  - Readers: `relsBetween`, `parentsOf`, `elementsOf` (what a concept's class thread reaches, from its header) and `entriesNaming`.
- **No changed helper or fake.** The fakes already run every statement ADR Decision 10 names. That was checked before the suites were written, by running R1–R5, W1 and W2 over a small graph through `graphFake.exec` and `fakeGraph`:
  - R1: the whole node, `{ ...properties, _labels }`, with a missing key and a change entry both giving no row;
  - R2: in both directions;
  - R3: `IN $keys`, with `labels(u)`;
  - R4 and R5;
  - W1: `relationshipsCreated` is 1, then 0 on a repeat;
  - W2: `relationshipsDeleted` is 0 for a missing pair, and 1 for the pair.
- **Firmware state:** none for the gate. The fixtures carry firmware's class threads as an install makes them.
- **The branch:** `A10.28-link-unlink-set`, the story's, never `staging` or `main`.

## The live check (at Implementation, on a scratch stack)

Never on a shared or private instance. Use a throwaway instance from `scripts/scratch-stack.sh` with `SCRATCH_IMAGE=agent-memory-tapestry`. Copy in the branch's `firmware/versions/v1.0.0/` and `bin/`, link `/usr/local/bin/tapestry` as the Dockerfile does, and restart the control panel. Record every step and number in the story, as story 5's live check did.

1. **Install.** Run `POST /api/firmware/install` on loopback inside the container, and record the TA (`/api/assistant/pubkey`). Check that `/api/concept-graph/summaries` lists `39998:<TA>:class-thread`, `…:set`, `…:superset` and `…:relationship-type`, and re-check the class thread's shape against the graph (ADR Context 11).
2. **Something to link.** Through today's routes, make a concept of the owner's with two sets, and a second concept. Count the relay's events: this is the baseline.
3. **The command.** From a shell inside the instance, `tapestry graph link-set --set <key> --parent <key>` and `tapestry graph unlink-set --set <key> --parent <key>` should get the routes' answers, each entry recorded as `local`.
4. **The agent (AC8).** An admin agent with its own throwaway key, made inside the instance, drives `clients/cli/bin/tapestry.js` through the instance's nginx, so it isn't trusted as local. It:
   1. links a set;
   2. links it again (`already-linked`);
   3. is refused a cycle;
   4. unlinks it;
   5. is refused its last parent.

   `graph history --node <set>` then reads the entries back as the agent's. A visitor through nginx gets 401.
5. **What firmware owns (AC6).**
   - `unlink-set` of the superset of `superset` from the superset of `set` (part (b)) is refused `firmware-link`.
   - `link-set` of an owner's set already under nostr-relay's organization-by-firmware, straight under nostr-relay's superset, is refused `firmware-prunes`.
6. **A reinstall (AC8).**
   - Re-make step 4's link, and take out another link the operations made. Record both.
   - Run `POST /api/firmware/install` again.
   - Afterwards the link made is still there, the link taken out is still gone, and step 5's firmware link is still there.
7. **A restore (AC8, BIBLE §30).**
   - Run `tapestry lifecycle backup`, then a link-set, then `tapestry lifecycle restore` of that backup.
   - The graph is as it was at the backup: that last link is gone, and the links made before the backup are there.
   - If time allows, restore the backup onto a second, fresh scratch instance too.
8. **Two writes at once (optional; AC2, Decision 9).**
   - Two identical link-sets at once: one `linked`, one `already-linked`, one entry.
   - Two link-sets at once that would make a two-set cycle (X under Y, Y under X): exactly one links, and the other is refused `cycle`.
   - Two unlink-sets at once that would take a set's last two parents: exactly one unlinks.
9. **The relay.** Its event count is step 2's baseline after every graph operation above. Nothing these operations do signs or sends anything.

### The live check (Implementation, 2026-11-15, on `d321da0a` plus ADR 0028 Amendment 2's lock)

**The instance.** It ran on the Mac Studio, as one throwaway instance, `tapestry-scratch-a1028`.
- **The script.** A copy of `scripts/scratch-stack.sh` with its three names changed, so it couldn't collide with story 16's. It booted only once story 16's instance was down, one instance at a time (ledger `2026-11-08-scratch-stack-one-shared-name`).
- **The image.** `agent-memory-tapestry`, with this branch's `src/` mounted. The image's firmware, `bin/` and `clients/` match this branch's (they are unchanged since the image's commit, `09dc9b7b`), so only `clients/` was copied in, for the agent.
- **Its identity.** It had its own assistant key (`f79c4ba4…`) and no published ports, and was removed afterwards.
- **The callers.** Calls through `docker exec` to `127.0.0.1:7778` are `local`. The agent's went through the instance's nginx (`http://127.0.0.1:80`).

1. **Install and orientation.** The firmware install ran at boot.
   - `/api/concept-graph/summaries` lists `39998:<TA>:class-thread`, `…:set`, `…:superset` and `…:relationship-type`.
   - nostr-relay's class thread reads `ConceptHeader` −IS_THE_CONCEPT_FOR→ `Superset` −IS_A_SUPERSET_OF→ `Set`, as ADR Context 4 says.
2. **Something to link.**
   - create-concept made *pet* and *household member*, signing as today's route does.
   - add-subset made *dogs*, *cats* and *birds* under pet's superset, and *residents* under household member's.
   - The relay went from 450 to 466 events: the baseline.
3. **The command.** `tapestry graph link-set` of dogs under residents answered `linked`, and `unlink-set` answered `unlinked`. Both were recorded as `local`.
4. **The agent (AC8).** It held a throwaway key made inside the instance and made an admin in the instance's settings, and drove `clients/cli/bin/tapestry.js`.
   - It linked dogs under residents: `linked`, recorded as `admin` with the agent's pubkey.
   - Again: `already-linked`, with no entry.
   - It was refused household member's superset under dogs: `cycle`, naming the chain.
   - It unlinked dogs: `unlinked`.
   - It was refused dogs' last parent: `last-parent`.

   `graph history --node dogs` read four entries back, newest first: the agent's two, then the command's two. A visitor through nginx got 401.
5. **What firmware owns (AC6).**
   - unlink-set of the superset of *superset* from the superset of *set* (part b) was refused `firmware-link`, naming the manifest's existing-sets.
   - An owner's set made under nostr-relay's set organized by firmware category, then linked straight under nostr-relay's superset, was refused `firmware-prunes`.
6. **A reinstall (AC8).** First, dogs was linked again under residents, and cats was linked under residents and taken out again. Then `POST /api/firmware/install` ran, in 72 s. After it:
   - dogs is still under residents;
   - cats is still not under residents;
   - the superset of superset is still under the superset of set;
   - the relay is unchanged, at 466.
7. **A restore (AC8).** `tapestry lifecycle backup` made `20261116T001555Z-d7e66277`. Then birds was linked under residents, and `tapestry lifecycle restore` of that backup ran. After it, birds is no longer under residents, and dogs is still under residents.
8. **Two writes at once (AC2, Decision 9).**
   - Two identical link-sets: one `linked`, one `already-linked`, and one entry.
   - Cats under birds and birds under cats, at once: one `linked`, and the other refused `cycle`.
   - **Two unlink-sets of birds' last two parents, at once: both answered `unlinked`, leaving birds under no parent.** On Neo4j 5.26 a relationship's `DELETE` doesn't lock its ends, which is the finding behind ADR 0028 Amendment 2.
     - **Without the lock.** Raced eight more times on a fresh set, *fish*, with the lock disabled, 3 of 8 rounds left it under no parent.
     - **With the lock.** With Amendment 2's lock, 8 of 8 came out right: one `unlinked`, one refused `last-parent`, one parent left, and no `tapestryLock` left on the node.
9. **The relay.** It held 466 events after every graph operation above, the baseline. Nothing these operations do signs or sends anything.

**Not run:** step 7's optional restore onto a second, fresh instance. Story 16's live check restored onto a fresh instance the same day, and the Docker VM's memory allowed only one scratch instance at a time.

## How to run

One suite at a time, with every endpoint dead:

```
export NEO4J_URI=bolt://127.0.0.1:9 REDIS_HOST=127.0.0.1 REDIS_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE_URL=http://127.0.0.1:9
node test/operations/graph/link-set.test.js
node test/operations/graph/unlink-set.test.js
node test/operations/graph/sets-agent-through-cli.test.js
node test/operations/rules/class-thread-acyclic.test.js
node test/operations/rules/set-has-a-parent.test.js
```

`node test/operations.test.js` runs them with every other operations suite. The full gate is `npm test`, which runs in CI on the pull request; on the Mac Studio it writes to the local instance.

## Readings: what the tests pin where the ADR left a choice

- **The answers.**
  - link-set: `{ link: { set, parent }, outcome, change }`.
  - unlink-set: `{ link, outcome, letters, change }`, with `letters: []` on `already-unlinked`.
  - Objects are compared without regard to key order.
- **The change entries.** Exactly `{ change: 'set-linked' | 'set-unlinked', type: 'IS_A_SUPERSET_OF', from: <parent key>, to: <set key> }`, plus `count` only when more than one copy was removed. The `type` is `IS_A_SUPERSET_OF` because that is CLASS_THREAD_PROPAGATION's alias in the active firmware.
- **The refusal bodies.**
  - `unknown-node`, `not-a-set` and `not-a-parent` carry `input` (`set` or `parent`) and name the key passed.
  - A concept header's refusal also names its superset's tapestryKey.
  - A guard's refusal carries `rule`: `cycle` comes from class-thread-acyclic and `last-parent` from set-has-a-parent, the same through the route and the command.
- **The words, read loosely.** A node is "named" by its name or its tapestryKey.
  - `cycle` names the chain from the set down to the parent, in that order; other words may come between. The "twelve, then *n* more" cut is checked on a fifteen-set chain.
  - `last-parent` names the parent, and both ways on: /link-set|another parent/ and `delete-set`.
  - `firmware-prunes` names the link a reinstall would take out (for shape 2, the earlier link, whose set may be no input) and `seed-firmware`.
  - `firmware-link` names its own part and none of the others, so a message that lists every part names none:
    - (a) the set file's name, `<f>.json`;
    - (b) `existing-sets`;
    - (c) `manifest`;
    - (d) "community reference".

    Each also names `seed-firmware`.
  - `peer-link` names the author's pubkey and says the point of view decides (/point of view|POV/).
  - For a card set, `not-a-set` and `not-a-parent` name the key passed and mention an address (/address/). Amendment 3: "The refusals' words name a node with no address … as one that isn't a set". The wording is the Implementer's.
- **The lock** (UL18). The refused call's transaction is found in the fake's log, as story 4's W6 finds one: by the rollback whose error names the node.
  - It must hold a write of the copies' shape, the lock Amendment 2 describes: the fake's kind `copies`, or `UNWIND … SET`.
  - This pins the lock before `requireEnds`' kind checks. It doesn't pin the lock before every read: a lock taken between `requireNodes` and the kind checks would also pass.
- **letters.** For a lettered set of the TA's or the owner's whose `s` tag names the parent's uuid: exactly one, `{ address: <the set's uuid>, says: <text naming the parent's uuid> }`. Otherwise `[]`.
- **What a check's finding names.** Its `item` is the item it was given. A set-has-a-parent check's message also names the set.
- **Not pinned:**
  - the order of `apply`'s own checks, beyond what Decision 1 makes observable;
  - which refusal comes first when a firmware or peer link is also the last parent;
  - the `when` text of each refusal;
  - the result schemas beyond the fields above;
  - the docs entries' section numbers (story 16's rule takes §4; whichever lands second renumbers).

## Verification

The new tests fail with the current code, each because its operation, rule or rules-document entry isn't there yet. Confirmed on 2026-11-15 on `8461d12a` (`A10.28-link-unlink-set`, the story and the ADR merged), plus these uncommitted tests, each suite run on its own with every endpoint dead:

```
operations: graph link-set: 0 passed, 19 failed, 0 skipped
  FAIL  LS1: the owner links a set under a second parent: one link, linked, its change entry; it keeps its first parent, and every concept above the parent reaches it
        src/operations/catalog/graph/link-set.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1): ls1-link answered 404 Cannot POST /api/tapestry/graph/link-set
  FAIL  LS17: a visitor is refused 401 and a stranger 403, and neither links anything
        src/operations/catalog/graph/link-set.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1): ls17-visitor answered 401 {"success":false,"error":"Sign in as the owner or an admin to do this."}
  FAIL  LS18: the command links a set too, recorded as the command's, and its refusal matches the route's
        src/operations/catalog/graph/link-set.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1): the command exited 2: Unknown operation 'graph link-set'. graph has: add-relationship, history, map-fields, mark-field, remove-relationship, unmark-field.
  FAIL  LS19: it is listed for an admin with its guard, repeatKey, inputs and refusals, and has its /docs entry
        src/operations/catalog/graph/link-set.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1): the list for an admin has graph add-relationship, history, map-fields, mark-field, remove-relationship, unmark-field
operations: graph unlink-set: 0 passed, 17 failed, 0 skipped
  FAIL  UL1: the owner unlinks a set from one of its two parents: gone, the set stays under the other, the parent's concept no longer reaches its element
        src/operations/catalog/graph/unlink-set.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1): ul1-unlink answered 404 Cannot POST /api/tapestry/graph/unlink-set
  FAIL  UL12: every class-thread link the shipped firmware's definition makes is refused firmware-link, naming its part (a sweep)
        src/operations/catalog/graph/unlink-set.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1): sweep-0 answered 404 Cannot POST /api/tapestry/graph/unlink-set
operations: an admin agent links and unlinks sets through the external CLI: 0 passed, 1 failed, 0 skipped
  FAIL  X3: the agent links a set, links it again, is refused a cycle, unlinks the set, and is refused its last parent, each through the external CLI
        src/operations/catalog/graph/link-set.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1): the external CLI exited 2: 'graph link-set' isn't among the operations npub1… may call on http://127.0.0.1:…: it may not exist there, or it may be the owner's only. This key may call:
operations: rule class-thread-acyclic: 0 passed, 9 failed, 0 skipped
  FAIL  CA1–CA8: rule class-thread-acyclic isn't loaded: src/operations/rules/class-thread-acyclic.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 3)
  FAIL  CA9: docs/GRAPH_RULES.md has no entry for class-thread-acyclic yet (ADR graph-operations-first-slice/0028 Decision 11)
operations: rule set-has-a-parent: 0 passed, 10 failed, 0 skipped
  FAIL  SP1–SP9: rule set-has-a-parent isn't loaded: src/operations/rules/set-has-a-parent.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 4)
  FAIL  SP10: docs/GRAPH_RULES.md has no entry for set-has-a-parent yet (ADR graph-operations-first-slice/0028 Decision 11)
```

Why each fails:

- **The routes and the command.** Each answers what an operation that isn't declared answers: 404 "Cannot POST", exit 2 with "Unknown operation", missing from the list, and to the external CLI "isn't among the operations". Each test first checks that the declaration is there, and its message says which one isn't, with that answer.
- **LS17 and UL16 would pass early otherwise.** The central check already answers a visitor 401, and a stranger 403, on a path no operation has, so a 401/403 alone proves nothing. They are paired with the declaration check and with the command's later answer, which shows the pair was untouched.
- **The rules.** They are found through the rules loader, so a missing file fails each test with that reason and no require crashes. The docs tests fail on the missing entries.
- **Every suite loads.** None throws at require, and each reports per-test failures.

The existing add-relationship suite, run the same way in this worktree, passes 12 of 12.

All five were also run in one process, through `test/operations.test.js`'s own `runDiscovered`, as the gate runs them: 0 passed and 56 failed, none of them failing to load. Against the reference below, the same run passed 56 of 56.

### The tests can pass, and catch what the ADR forbids: checked against a throwaway reference

A failing test proves little if no correct code could pass it. So the five suites were also run against a quick reference of `_sets.js`, the two declarations, the two rules and the two rules-document entries. It was written from the ADR alone, in a scratch copy of the tree outside the repository, with its own link to the parent checkout's `node_modules`. The reference never entered the repo, will be deleted, and is not the implementation.

Against it, every suite passed, each run on its own: link-set 19 of 19, unlink-set 17 of 17, X3 1 of 1, CA 9 of 9, SP 10 of 10.

Then the reference was broken one way at a time, and the tests written for each break failed:

| Broken | Failed |
|---|---|
| the walk up follows `HAS_ELEMENT` and `IS_THE_CONCEPT_FOR` as well as the propagation link | CA8 |
| the cycle rule judges every item, whatever its kind | CA6 |
| the chain is named from the parent up to the set | CA4, LS10 |
| a fifteen-set chain is named whole | CA5 |
| an element above a set counts as its parent | SP6, SP8 |
| a superset isn't exempt | SP5, SP8, SP9, UL9, UL11, UL12 |
| an unlink of a link that isn't there is judged | SP4, UL4 |
| the last-parent message gives no way on | SP3, UL8 |
| any prunable link refuses, an older redundancy included | LS11 |
| only the new link itself is checked (shape 1 alone) | LS13 |
| the prune covers every firmware concept, manifest.json or not | LS14 |
| a repeat is checked against the prune first | LS4 |
| a concept header's refusal doesn't name its superset | LS6, UL10 |
| firmware's set files (a) don't count | UL11, UL12 |
| `categoryToSlug` loses its two overrides | UL12 |
| a firmware refusal lists every part | UL11, UL12 |
| "own" leaves out the owner | UL6 |
| a would-be `s` tag counts as a letter | UL7 |
| a letter is reported whatever parent its `s` tag names | UL13 |
| two copies are counted as one | UL5 |
| the peer check is left out | UL14 |
| a repeat records an entry | LS4 |
| the entry names the link backwards | LS1, LS2, LS4 |

Two first runs found faults in the tests, both fixed:

- CA5 passed a message that named all fifteen sets and still said "3 more". It now checks that at most twelve of the thirteen between the ends are named.
- A walk that also follows `IS_THE_CONCEPT_FOR` alone is harmless: a header is never a set, so such a walk can't come back to one. The break that matters, a walk that also follows `HAS_ELEMENT`, is what CA8 catches. Every header is an element of the concept-header concept's superset.

**Not reachable stack-free:** the re-check after the write (Decision 9). With either declaration's re-check taken out of the reference, every suite still passed (link-set 19, unlink-set 17, X3 1), since only a second writer between the guard and the write can make it disagree. That is the live check's step 8.

### Amendment 3's tests (2026-11-15, at Review's request, on `f77faea7`)

The review's blocking finding and its non-blocking item 9 led to ADR 0028 Amendment 3: a set has an address. These tests are new: LS20, LS21, UL19–UL21, CA10, SP11 and SP12. UL18's refused half changed: it now uses a refusal inside `apply`, after the lock.

Each suite was run on its own, with every endpoint dead, against the implementation at `f77faea7`. Every new or changed test fails for the reason Amendment 3 names, and the 56 tests left as they were all pass:

```
operations: graph link-set: 19 passed, 2 failed, 0 skipped
  FAIL  LS20: a trust-pipeline card set, labelled Set but with no address, is refused not-a-set, named as a node with no address
        ls20-card-set: 409 not-a-set; got 200 {"success":true,"data":{"link":{…},"outcome":"linked",…
  FAIL  LS21: a card set as the parent is refused not-a-parent, named as a node with no address; nothing changes
        ls21-card-set-as-parent: 409 not-a-parent; got 200 {"success":true,"data":{"link":{…},"outcome":"linked",…
operations: graph unlink-set: 17 passed, 4 failed, 0 skipped
  FAIL  UL18: an unlink leaves the set's own properties as they were, unlinked or refused after its lock: the lock leaves nothing behind
        the refused unlink took its lock before it refused not-a-set, and the rollback took it away (ADR 0028 Amendment 3, item 1: the lock is the first thing apply does); its transaction ran ["read","read","read","read","read","read"]
  FAIL  UL19: a trust-pipeline card set, labelled Set but with no address, is refused not-a-set, even one a link puts under a set
        ul19-card-set: 409 not-a-set; got 409 {"success":false,"error":"<card set key> is under no superset or set other than \"Pets\" (…), so taking it out from under that parent would leave it under none, …
  FAIL  UL20: a card set as the parent is refused not-a-parent, named as a node with no address; nothing changes
        ul20-card-set-as-parent: 409 not-a-parent; got 200 {"success":true,"data":{"link":{…},"outcome":"unlinked","letters":[],…
  FAIL  UL21: a card set doesn't count as a parent: a set whose only other incoming link is from one is refused last-parent from its real parent
        ul21-a-card-set-is-no-parent: 409 last-parent; got 200 {"success":true,"data":{"link":{…},"outcome":"unlinked","letters":[],…
operations: an admin agent links and unlinks sets through the external CLI: 1 passed, 0 failed, 0 skipped
operations: rule class-thread-acyclic: 9 passed, 1 failed, 0 skipped
  FAIL  CA10: an item with a trust-pipeline card set at either end gives no finding, even where a walk that took it for a set would come back
        cardSetAsSet: no finding; got [{"item":{…},"code":"cycle","message":"<card set key> under \"Below cards\" (…) makes a cycle in the class thread: …
operations: rule set-has-a-parent: 10 passed, 2 failed, 0 skipped
  FAIL  SP11: as a check, a trust-pipeline card set gives no finding, under no parent or under one: it isn't a set of the concept graph
        cardSetCheck: no finding; got [{"item":{…},"code":"last-parent","message":"<card set key> is under no superset or set, …
  FAIL  SP12: a card set doesn't count as a parent: as a guard, a set whose only other parent is one is last-parent; as a check, one under only a card set
        cardSetNotAParentGuard: one last-parent finding; got []
```

Why each fails:
- **`kindOf` reads labels alone.** So a card set is taken as a set:
  - link-set links it as `set` and as `parent` (LS20, LS21);
  - unlink-set's guard judges it as a set, and answers `last-parent`, not `not-a-set` (UL19);
  - unlink-set takes a link out from under it (UL20);
  - it counts as a set's other parent (UL21, SP12);
  - the check reports it (SP11);
  - the cycle rule walks through it (CA10).
- **unlink-set locks after `requireEnds`.** So `not-a-set` comes before the lock, and the refused transaction ran only reads (UL18). The unlinked half, UL1's, passes as before.

**Checked against a throwaway reference.** Amendment 3 was applied to a scratch copy of `f77faea7`, outside the repository, and deleted afterwards:
- `kindOf` answers `'other'` for a node with no `uuid`;
- the two refusals' words say a set or superset has an address;
- unlink-set's lock moved before `requireEnds`.

Every suite then passed, each run on its own: link-set 21 of 21, unlink-set 21 of 21, X3 1 of 1, CA 10 of 10 and SP 12 of 12. Then the reference was broken one way at a time:

| Broken | Failed |
|---|---|
| only the declarations check for an address, and the rules still read labels | UL19, UL21, CA10, SP11, SP12 |
| the refusals don't name a node with no address | LS20, LS21, UL19, UL20 |
| unlink-set locks after `requireEnds`, as before Amendment 3 | UL18 |
| unlink-set takes no lock at all | UL18 |
| set-has-a-parent counts any parent labelled Set or Superset | SP12, UL21 |
| set-has-a-parent judges any node labelled Set as a set | SP11, UL19 |
| class-thread-acyclic judges a parent by its labels | CA10 |
| class-thread-acyclic judges a set by its labels | CA10 |

"unlink-set takes no lock at all" is now caught stack-free, by UL18's look at the refused transaction. In the review's breaks of the real code, nothing caught it.

## Gaps and questions for the gate

1. **ADR Context 7's count.** The prune covers "35 of the 40" firmware concepts. Of the 40 in v1.0.0's manifest, 29 have a manifest.json. The 11 without one:
   - node-type, relationship, property, properties-set, property-tree-graph;
   - nostr-event, graperank, web-of-trust;
   - class-thread, word-wrapper, tag-pinning.

   The rule the ADR states, whose folder has a manifest.json, is install's and is what LS14 tests. Only the number is off.
2. **A firmware or peer link that is the set's last parent is refused `last-parent`, not `firmware-link` or `peer-link`.** The write path runs the guard before `apply`. After an install's prune, most part-(a) and part-(c) firmware links are their set's only parent, for example:
   - relationship-type's three sets;
   - nostr-kind's four;
   - free-relays, under organization-by-monetization alone.

   On a real instance, then, `firmware-link` answers only for parts (b) and (d), whose sets are supersets and exempt, and for firmware sets the owner gave a second parent. A peer's set the owner never linked elsewhere is likewise refused `last-parent`. Either way nothing changes, but AC6's "naming what makes the link" holds only in those cases. The tests give each firmware and peer set a second parent and pin neither order. Owner's or Architect's call.
3. **"A test can still show that a finding there rolls the write back" (ADR, notes for the Tester).** With one writer, the guard and the re-check see the same graph, so the guard always refuses first and the re-check never finds anything. No seeded graph makes them differ. The rollback after a `MERGE` is shown instead through `firmware-prunes` (LS12, LS13); the re-check itself is left to the live check's step 8.
4. **`N.UNKNOWN_NODE`'s `when`** reads "A from or to that names no node". Reused as the ADR says, it would describe link-set's and unlink-set's `set` and `parent` that way in the list, the command's help and `/docs`. No test pins the `when` text.
5. **"A repeat never refuses" (Decision 1, step 3) holds for `apply` only.** The guard runs first, so a link-set of a link already on a cycle an old route made is refused `cycle`, though the link is there. Not pinned; CA7 shows the check finds such links.
6. **Possible, unverified:** an instance whose TA is a community reference's curator. The local Mac's TA is the `tag` family's curator. There, install's part (d) would MERGE the `tag` superset onto itself, since `src/firmware/install.js:1295` doesn't compare its two ends. That makes a self-loop, which class-thread-acyclic's check reports and which unlink-set would refuse to take out as part (d). It wasn't checked against a live graph, since the local stack is off limits.
7. **Test ids.** The agent test is `X3`: story 4's agent suite (`agent-through-cli.test.js`) has `X1`, and story 5's has `X2`, so each agent test id stays unique across suites.

**From Amendment 3's tests (at Review):**

8. **The tests can't tell the uuid rule from the label rule it rejected.** Amendment 3 chose "a set has an address" over leaving out the label `SetOfNostrUserWotMetricsCards`. Every address-less node labelled `Set` in a real graph today is a card set, and every fixture of one carries that label too, so an implementation of either rule passes. Pinning the choice would need an address-less `Set` that isn't a card set, and none exists.
9. **A card-set link already made can't be taken out by either operation.** UL19 shows unlink-set refuses a card set as `set` even when a link puts it under a set, and UL20 refuses one as `parent`. After Amendment 3, link-set can't make such a link. Only the link-set before Amendment 3 could, and that ran only on this branch and its scratch stack, so no shared instance should hold one. Recorded, not tested further.
10. **What isn't reachable stack-free.**
    - Amendment 3's item 2, the re-check's `last-parent` naming the parent, is on the race path only, like the re-check itself (live check, step 8).
    - Item 3, part (c) resolving set files only, changes nothing for v1.0.0, since all ten edges link a set to a set. The fixture's reading of part (c) now follows it; no shipped edge can show the difference.
