# Test Plan: Story 8 — A firmware install's Pass 3 finishes in minutes

**Story:** `engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.md`
**ADR:** none. This is a bug on the Standard bug path; the owner chose to skip Architecture on 2026-11-15.
**Date:** 2026-11-15
**Approved:** by the owner, 2026-11-15.

One suite, `test/pass-3-finishes-in-minutes.test.js`, in two parts.

- **Stack-free**, in every run, CI included. The real rebuild code runs in a child process (`test/helpers/pass3DeriveChild.js`): `src/lib/tapestry-derive.js`, the derivers, and the derive-status handler as `registerTapestryKeyRoutes` registers it. Two modules are replaced:
  - **`src/lib/neo4j-driver.js`.** A read of one node runs on the fake graph database of story 7 (`test/helpers/nodeCypherFake.js`), as Neo4j would. A read it can't run (a relationship pattern, `OPTIONAL MATCH`, `UNION` …) answers no rows and is listed, so the derivers run with empty neighbourhoods. Every write is recorded with its parameters.
  - **`src/lib/tapestry-store.js`.** An in-memory cache that records every put.

  So the tests read what was rebuilt from what reached the cache and from the writes that set `tapestryJsonUpdatedAt`, which name a node by its key, its uuid or its element id. They don't read the query text.
- **Live**, only when `TAPESTRY_CONTAINER` names a scratch container. Its name must start with `tapestry-scratch`, so these checks never touch the shared `tapestry` stack (on the owner's Mac that instance holds an agent's memory). Every live call goes through `docker exec <container> curl` to the control panel on loopback (`test/helpers/scratchLoopback.js`). Each live check says which graph it needs and skips, saying why, on any other:
  - **a small graph:** a scratch stack as `scripts/scratch-stack.sh up` leaves it, about 3,200 nodes;
  - **staging's shape:** the same stack seeded by `test/helpers/seedStagingShape.js` (below).

## The stack-free graphs

- **after**, as on staging since `tapestry-keys`. Every node is keyed and labelled `TapestryNode`. The concept graph has one node of each kind, carrying the labels it carries on a real instance:
  - `ListItem:NostrEvent`;
  - `ListItem:NostrEvent:Superset`;
  - `ConceptHeader:ListHeader:NostrEvent`;
  - `ListItem:NostrEvent:Property`;
  - `JSONSchema:ListItem:NostrEvent`;
  - two of `ListItem:NostrEvent:Set`;
  - `ListHeader:NostrEvent`.

  Each has a `uuid`, an `id` and a key. Beside them are:
  - an **event-less set**, `ListItem:Set` with a uuid and no id;
  - **three card sets**, `Set:SetOfNostrUserWotMetricsCards`, keyed, with no uuid and no id;
  - a **stray keyed node with no address** under each of the six other labels;
  - an **addressed node with no key**;
  - 20 keyed `NostrUser` nodes and a metrics card, standing for staging's millions.
- **before**, as on production today, before story 3. There is no `TapestryNode` label anywhere. The same concept-graph nodes are keyed. The event-less set has `NostrEvent`, as add-subset's sets had then. The card sets and users have no key.

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC1 — Pass 3 rebuilds only nodes with an address | **S1a** after: `deriveAll` of each of the seven labels, in Pass 3's order, caches and stamps exactly that label's nodes with a key and an address (the event-less set included), never a card set or a stray, and never caches under no key · **S1b** before: every addressed node is still rebuilt on a graph with no `TapestryNode` label · **L1** small graph: 30 keyed card sets and a stray under each other label are added, with an event-less set; after `derive-all` of the seven labels, none of the strays is cached or stamped, and every node with an address was rebuilt by the pass | stack-free (child), live |
| AC2 — derive-status counts the nodes Pass 3 rebuilds | **S2a** after, part rebuilt (with a card set and a stray stamped, as today's code leaves them): each label's `total`, `derived` and `underived` count only its keyed nodes with an address · **S2b** after, all rebuilt: the same, and every label reads `derived = total` · **L2** any graph: with card sets and strays added, each label's `total` equals the count of its keyed, addressed nodes (on staging's shape, Set: 22, not 370,404) · **L2b** after L4: every label reads `derived = total` | stack-free (child), live |
| AC3 — a rebuild doesn't read the whole graph | **L3** staging's shape: a rebuild by key of one node of each label (`POST /api/tapestry-key/derive/:key`, the TA's where there is one), median of 3, takes at most 200 ms; and inside `derive-all` of ConceptHeader each node takes at most 200 ms · **M3** (measurement, below): the same times on the small graph, and the ratio | live |
| AC4 — the whole of Pass 3 finishes in minutes | **L4** staging's shape, `PASS3_INSTALL=1`: a firmware install's Pass 3, from its "── Pass 3:" line to "FIRMWARE INSTALL COMPLETE", takes under 10 minutes, and the install answers success. It prints the time before Pass 3 and the time of each step. On a timeout it restarts the scratch control panel to stop the install · **M1, M2** (measurements, below) | live |
| AC5 — nothing else changes | **S5** after: a rebuild by key of a card set is still a rebuild (answered, and cached), as is one of an addressed set · **L5c** any graph: `POST /api/tapestry-key/derive/<a card set's key>` answers its rebuild, as today · **L5a** small graph: after `derive-all` of the seven labels, each node with an address holds, as a set, what today's queries find for it: elementOf (direct, indirect); for a set or superset, its elements, child sets and parent sets; its schemas. It also holds its identifiers and the deriver that rebuilt it · **L5b** after a full rebuild in the run: the firmware's nodes' rebuilt Tapestry JSON, the JSON schemas' json tags and each superset's HAS_ELEMENT targets match the baseline taken from today's code | stack-free (child), live |
| (the fake) | **S0**: `labels()`, `elementId()` and `id()` read a node as Neo4j would, and `elementId(n) = $e` finds it | unit |

S0, S1b and S5 pass today, and must keep passing:
- **S1b** fails a fix that reads only `TapestryNode` nodes. Production has none until `tapestry-keys` runs there.
- **S5** fails a fix that leaves out nodes with no address inside the derivers. That would change the rebuild by key, which AC5 keeps.
- **S0** checks the fake.

L5c, L5a and L5b also pass today: they are guards on what the rebuild finds.

### Measurements to record

- **M1, today's per-node times and the estimate they give** (recorded under Verification, from 2026-11-15 on the seeded stack). One rebuild by key took 3.45 s for a ListItem, 4.7 s for a concept Set and 4.6 s for a card set. `derive-all` of the 40 ConceptHeaders took 75.2 s, 1.9 s each. One lookup that reads every node took 0.45–1.35 s; one that starts from a node's own edges took 3–4 ms. That makes about 14 days for Pass 3 on the seeded stack, nearly all of it the 370,377 card sets.
- **M2, the time before Pass 3** (Pass 1, Pass 2 and the community headers), and each step of Pass 3, as L4 prints them. Story 8 doesn't bound them. Anything slow they show becomes a story of its own (Out of scope).
- **M3, AC3's second bullet.** Run L3's rebuild by key on a small graph as well as on staging's shape: `scripts/scratch-stack.sh up`, then `POST /api/tapestry-key/derive/:key` for the same kinds of node, median of 3. Each median on staging's shape is at most 1.5 times the small graph's. This is recorded rather than asserted, since one run of the suite sees one graph.

## Edge cases

- [x] An address that is a uuid and an id, or a uuid only (the event-less set): S1a, S1b and L1.
- [x] A keyed node with no address under every label Pass 3 rebuilds, not only `Set`: S1a, S2a and L1.
- [x] A card set that today's code has already rebuilt, with a `tapestryJsonUpdatedAt` of its own: S2a and S2b. It must not count as derived either.
- [x] An addressed node with no key is never rebuilt, and nothing is cached under no key. Candidate (d) under Verification shows this catches `key AND uuid OR id`.
- [x] A graph that hasn't run `tapestry-keys`, with no `TapestryNode` label: S1b.
- [x] A rebuild by key of a node with no address keeps today's behaviour: S5 and L5c.
- [x] The community headers that firmware install fetches can change upstream, so L5b compares only the firmware's own nodes. Those are the TA's, and the tag concepts under ADR 0015's literal pubkey, read from `LEGACY_Z_TAG_PUBKEY` in `src/api/profile-tags/index.js`.
- [ ] A `'{}'` key: not covered. Today's rebuild selects it as a key, and this story doesn't change that.
- [ ] Concurrent installs: not applicable. The install runs as one request.

## Test infrastructure

- **Framework:** Node's built-in runner. The suite is one line in `test/registry.js`. `test/stack-free-npm-test.test.js` G5 confirms every suite file is registered.
- **`test/helpers/nodeCypherFake.js`** (story 7's) now also reads a node's `labels(v)`, `elementId(v)` (`4:fake:<its place in the list>`) and `id(v)`. Derive-all's own selection returns `labels(n)`, and a fix may name a node by its element id. Story 7's suite passes 7 of 7 with it. **The Implementer doesn't edit the fake.** A fix whose one-node reads it can't run is a kick-back to the Tester. A read that answers no rows because the fake can't run it is listed in the failure message.
- **`test/helpers/pass3DeriveChild.js`** is the child process, with its two stubs. It runs `deriveAll` over a list of labels, `deriveByKey` over a list of keys, or the derive-status handler.
- **`test/helpers/scratchLoopback.js`** holds the live calls: HTTP and Cypher through `docker exec`, with curl's own `time_total`. It refuses any container not named `tapestry-scratch…`. The live fixtures carry `pass3Fixture: <run>` and are removed (`DETACH DELETE`) after each check. A cache entry today's code writes for a fixture card set stays in the scratch cache, which is thrown away with the stack.
- **`test/helpers/seedStagingShape.js`** seeds staging's shape: 3,107,258 keyed `NostrUser` nodes, the first 370,377 of them each owning a keyed `Set:SetOfNostrUserWotMetricsCards` that holds a keyed `NostrUserWotMetricsCard`. That is 3,851,244 nodes with the firmware's, against staging's 3,851,736. It also adds the setup indexes of `setup/neo4jConstraintsAndIndexes.sh`, then the `tapestry_key` rule, online. It takes about 2.5 minutes. (`tapestry lifecycle migrate --migration tapestry-keys` can't add the rule on the scratch stack: its first read goes over the stack's 512 MB transaction limit. So the seeder adds the rule with the migration's own statement.)
- **`test/helpers/pass3Snapshot.js` and `test/fixtures/pass-3-snapshot-today.json`.** The baseline for L5b, taken from today's code. It holds, for the firmware's nodes:
  - a hash of each node's rebuilt Tapestry JSON;
  - a hash of each JSON schema's json tag;
  - each superset's HAS_ELEMENT targets;
  - the digest of the container's `firmware/active`.

  The TA reads as `<TA>`, and a key reads as the address of its node. Times are left out, and so are the slugs inside node references, since those depend on the order of rebuilding. L5b skips, saying so, when the firmware differs from the baseline's.

  **How the baseline was taken:** boot a fresh scratch stack on today's code, run `derive-all` of the seven labels once (a rebuild after the install's own wiring, the state every later rebuild leaves), then run `node test/helpers/pass3Snapshot.js`.
- **Firmware state:** the live checks need firmware installed, which `scripts/scratch-stack.sh up` does. No reinstall is needed for the fix itself.

## How to run

The scratch stack mounts this checkout's `src/` over an image. Boot it from an image built from staging's code (`SCRATCH_IMAGE=…`), since the firmware it installs comes from the image. L5b's baseline was taken with `agent-memory-tapestry:latest`, built 2026-11-15 from `39126bfc`. Another image's firmware makes L5b skip, saying so.

```
node test/pass-3-finishes-in-minutes.test.js                                    # stack-free only (live checks skip)
TAPESTRY_CONTAINER=$(SCRATCH_IMAGE=agent-memory-tapestry:latest bash scripts/scratch-stack.sh up) node test/pass-3-finishes-in-minutes.test.js    # + small graph: L1, L2, L5c, L5a, L5b
TAPESTRY_CONTAINER=tapestry-scratch node test/helpers/seedStagingShape.js       # seed staging's shape
TAPESTRY_CONTAINER=tapestry-scratch PASS3_INSTALL=1 node test/pass-3-finishes-in-minutes.test.js       # + staging's shape: L2, L5c, L3, L4, L2b, L5b
bash scripts/scratch-stack.sh down
npm test                       # the full gate, from the pull request's CI (on the Mac Studio, run suites one at a time)
```

## Verification

The new tests fail on the current code, at `6276558c`, the story's commit on `install-derive-stall`, branched from `staging` at `0ebe1795`. They fail for the bug's reason:
- keyed nodes with no address are rebuilt, and counted by derive-status;
- each rebuild reads the whole graph.

Run 2026-11-15 on the Mac Studio. The scratch stack was `scripts/scratch-stack.sh up` with `SCRATCH_IMAGE=agent-memory-tapestry:latest`, an image built that day from `39126bfc` (staging's code). The default image, `tapestry-tapestry`, is two months older. Neo4j 5.26.10 Community, with 512 MB of page cache.

**Stack-free** (no container):

```
  PASS  S0 (the fake)
  FAIL  S1a (AC1)
        after tapestry-keys:
        ListItem: rebuilt nodes with no address — cached ["k-stray-ListItem"], stamped ["k-stray-ListItem"]
        …
        Set: rebuilt nodes with no address — cached ["k-card-set-1","k-card-set-2","k-card-set-3"], stamped ["k-card-set-1","k-card-set-2","k-card-set-3"]
        Superset: rebuilt nodes with no address — cached ["k-stray-Superset"], stamped ["k-stray-Superset"]
  PASS  S1b (AC1)
  FAIL  S2a (AC2)
        Set: want {"derived":1,"underived":2,"total":3}, got {"derived":2,"underived":4,"total":6}   (and each other label, off by its stray)
  FAIL  S2b (AC2)
        Set: want {"derived":3,"underived":0,"total":3}, got {"derived":4,"underived":2,"total":6}
  PASS  S5 (AC5)
pass-3-finishes-in-minutes: 3 passed, 3 failed, 8 skipped
```

Story 7's `cache-counts.test.js` passes 7 of 7 with the extended fake, and the operations gate (`test/operations.test.js`) passes 337 of 337. `stack-free-npm-test.test.js` passes 7 of 7: G5 finds the new suite registered.

**The tests accept correct fixes and catch wrong ones.** Five candidate changes were tried in the working tree, and `src/` was put back after each (`git status src` clean). None is committed: the fix is the Implementer's. They cover AC1 and AC2. AC3 and AC4 are about time, which only the live checks see.

| Candidate | S0–S5 |
|---|---|
| (a) the address filter, `AND (n.uuid IS NOT NULL OR n.id IS NOT NULL)`, in derive-all's selection and in derive-status | all pass |
| (b) the derivers skip a node with no uuid; derive-status filtered | S5 fails (a rebuild by key of a card set changes) |
| (c) only `TapestryNode` nodes with a uuid, in both | S1b fails (an instance before `tapestry-keys`) |
| (d) the precedence slip, `tapestryKey IS NOT NULL AND uuid IS NOT NULL OR id IS NOT NULL` | S1a, S2a and S2b fail |
| (e) derive-all's selection filtered, derive-status left as it is | S2a and S2b fail |

**Live, staging's shape** (seeded by `seedStagingShape.js`, 3,851,244 nodes; `PASS3_INSTALL=1`):

```
  SKIP  L1 (AC1, live, small graph)
  FAIL  L2 (AC2, live)
        ListItem: want total 404, got 405   (… each label off by its stray)
        Set: want total 22, got 370404
  PASS  L5c (AC5, live)
  SKIP  L5a (AC5, live, small graph)
        rebuild by key, median of 3 (ms): {"ListItem":3368,"ListHeader":3335,"ConceptHeader":3461,"JSONSchema":3467,"Property":3487,"Set":4817,"Superset":4746}; inside derive-all ConceptHeader: 1926 ms each (40 in 77.0 s)
  FAIL  L3 (AC3, live, staging's shape)
        before Pass 3 (Pass 1, Pass 2, community headers): 57 s; Pass 3 steps (s): {}; Pass 3 in all: null s
  FAIL  L4 (AC4, live, staging's shape, PASS3_INSTALL=1)
        Pass 3 did not finish within 10 minutes (reached: pass3); the scratch control panel was restarted to stop the install
  SKIP  L2b (AC2, live, after L4)
  SKIP  L5b (AC5, live, after a full rebuild in this run)
pass-3-finishes-in-minutes: 4 passed, 6 failed, 4 skipped
```

In L4's 11 minutes, today's Pass 3 didn't finish even its ListItems: 404 of them at 1.9 s each is about 13 minutes. The restart stopped the install, and the control panel answered again within 30 s.

**Live, a small graph** (a fresh `scripts/scratch-stack.sh up`, 3,232 nodes). Before this run, the baseline was taken on this stack: one `derive-all` of the seven labels (404 ListItems in 13.1 s, about 32 ms each), then `pass3Snapshot.js`. It covers 448 firmware nodes, 40 schemas and 17 supersets' elements, with firmware digest `820c697cfa7b566c…`.

```
  FAIL  L1 (AC1, live, small graph)
        36 of 36 keyed nodes with no address were rebuilt, e.g. [{"k":"9375ff22-…","labels":["TapestryNode","Set","SetOfNostrUserWotMetricsCards"]}, …]
  FAIL  L2 (AC2, live)
        Set: want total 22, got 27   (… each label off by its stray)
  PASS  L5c (AC5, live)
  PASS  L5a (AC5, live, small graph)
  SKIP  L3, L4, L2b (staging's shape / PASS3_INSTALL)
  PASS  L5b (AC5, live, after a full rebuild in this run)
pass-3-finishes-in-minutes: 6 passed, 5 failed, 3 skipped
```

**M1, today's times** (2026-11-15, the seeded stack). One rebuild by key took 3.3–4.8 s. Inside `derive-all` each rebuild took 1.9 s. Per query, a lookup that reads every node took 0.45–1.35 s, against 3–4 ms for one that starts from a node's own edges. At those times, Pass 3's 370,399 Sets alone would take about 14 days.

**M2, before Pass 3: 57 s** on the seeded stack (Pass 1, Pass 2 and the community headers). Story 5's install on staging took about 20 minutes to reach Pass 3 (19:09 to 19:30 UTC). Staging also publishes to relays and has more data behind it, so the scratch figure isn't evidence that staging's time comes from the graph's size.

**M3:** recorded after the fix, on both graphs.
