# Test Plan: Story 4 — The write path

**Story:** `engineering-team/stories/graph-operations-foundation/4-the-write-path.md`
**ADR:** `engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md` (with its Amendment 1)
**Date:** 2026-11-14

## Coverage map

Every suite is stack-free and lives under `test/operations/`, where `test/operations.test.js` finds and runs it (ADR 0001 Decision 12). Each runs on its own too: `node <file>`.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — Add a relationship | AR1 the owner adds a declared type: one relationship, its entry answered and kept · AR2 the same call again adds nothing and records nothing · AR3 a type declared under a set, to a NostrUser · W4, W5 the path's record and repeat | `graph/add-relationship.test.js`, `write-path.test.js` | integration (route and command over the fake graph) |
| AC2 — The guard refuses before anything changes | AR4 undeclared type · AR5 reserved type, declared or not · AR6 a node that isn't there, or a change entry · AR7 a type that isn't a plain name · W6 a guard refuses before `apply` runs, rolled back · R1–R7 the rule's one definition, as a guard and as a check · R8 every firmware type reserved · R9 every type the code names reserved · R10 the rules document | `graph/add-relationship.test.js`, `write-path.test.js`, `rules/relationship-type-allowed.test.js` | integration; unit (the rule) |
| AC3 — Remove a relationship | RR1 removes it, with its entry and a count · RR2 again: already-gone, nothing recorded · RR3 two removed, count 2 · RR4 a class-thread edge can't be removed · RR5 an undeclared type is refused even where one exists · RR6 a node that isn't there | `graph/remove-relationship.test.js` | integration |
| AC4 — Each change is recorded with it | W4 one entry: id, at, by, operation, what changed, kept as a `GraphChange:TapestryNode` with its keys · W5 a repeat records none · W6, W7, W8 a refusal or failure keeps neither · W9 a failed entry write keeps neither · W10 who: owner, admin, the command · AR1, AR10, AR11, RR1 | `write-path.test.js`, both operations' suites | integration |
| AC5 — `graph history` | H1 newest first, 50 a page, the cursor pages through exactly once · H2 by node, by who, since, combined, and since without milliseconds · H3 the cap · H4 a bad cursor · H5 bad inputs · H6 add-relationship's entry read back · H7 callers, the command · H8 history writes nothing · I1–I3 the indexes made at start · *survives a restart, carried by backup, in step after restore: the live check* | `graph/history.test.js`, `change-indexes.test.js` | integration; unit (the boot hook); live |
| AC6 — JSON only, nothing signed | W11 text/plain, a form and no Content-Type refused 415, a visitor 401 first, a charset accepted, a `run` write held to it too · W11b lifecycle backup with no Content-Type takes no backup · AR8, RR7 the spy sees no signing, publishing or key read · *the relay's event count: the live check* | `write-path.test.js`, both operations' suites | integration; live |
| AC7 — Callers, the command, an agent | AR9, RR7, H7 401 and 403 · AR11, RR7, H7 the command answers as the route, its entries name the command · W12 the same words for a failure from route and command · AR12 listed with guard, repeatKey and refusals, and in `/docs` · X1 an admin agent adds, removes and reads both back through the external CLI | both operations' suites, `graph/history.test.js`, `write-path.test.js`, `graph/agent-through-cli.test.js` | integration (the real external CLI against a loopback instance) |
| — the fake itself | F1–F7: the fake graph answers ADR 0004's statements as Neo4j would, rolls back on a throw, and names a statement it can't run | `graph-fake.test.js` | unit |

## Edge cases

- [x] **A repeated call:** AR2, RR2 and W5. It changes nothing, records nothing, and says so.
- [x] **Duplicates an older path made:** RR3 removes both, and its entry counts them.
- [x] **A change entry named as a node:** AR6. An entry can't be linked to or changed.
- [x] **A declared but reserved type:** HAS_ELEMENT (AR5, RR4, R2). Reserved wins.
- [x] **Broken declarations:** an element whose json doesn't parse, or names no alias, declares nothing (R4).
- [x] **A json tag offloaded to LMDB:** R5.
- [x] **The relationship type concept missing,** as before a firmware install: R6.
- [x] **A tie in history's order:** H1. The later tapestryKey comes first.
- [x] **`since` without milliseconds:** H2, which keeps the entry at that very instant.
- [x] **A form body and a body-less POST:** W11 and W11b. A body-less POST would otherwise take a backup cross-site.
- [x] **A failure between the change and its entry:** W9.
- [ ] **Concurrent calls of the same add:** the live check. The fake runs transactions one at a time.
- [ ] **The graph database not answering:** the path's generic failure, 500 `failed` (W8 shows the shape), on a live graph in the live check.
- [ ] **A firmware install** leaves a relationship of a type firmware doesn't declare alone: the live check (story, open question for Architecture).

## Test infrastructure

- **Runner.** Node's built-in runner through `test/operations.test.js`, which the gate runs (`test/registry.js`). No new framework.
- **No live API in the gate.** The local instance at `:7778` is the owner's agent-memory instance and must not be written to. The gate runs in CI on the pull request. On the Mac Studio, run only these suites, never the full `npm test`. The live check runs on a scratch stack at Implementation (below).
- **New helpers:**
  - `test/helpers/graphFake.js`: the fake for `src/operations/graph.js`.
  - `test/helpers/graphOpsSuite.js`: what the suites share. That covers the callers, a child environment whose services are all dead (in its conf and its environment), the harness run, and the seeded graph. The seeded graph holds this instance's relationship type concept with seven elements, plus A, B, U and an existing entry G.
- **Changed helpers:**
  - `test/helpers/operationsHarness.js`:
    - `graphFake: { stateFile }`, per scenario;
    - `spy`, which records nostr-tools' `finalizeEvent`, `loadTAKey` and `signAndFinalize`, any `SecureKeyStorage` method, and any child process that names strfry;
    - `formBodies`;
    - `noContentType`.
  - `test/helpers/externalCliServer.js`: `graphFakeState`.
  - `test/helpers/nodeCypherFake.js`: reads a property map in its node pattern.
- **The fake graph runs ADR 0004's statements only,** and throws on anything else, naming the statement (F7). The Implementer's Cypher stays within these shapes:
  1. **A read of one node,** in `nodeCypherFake.js`'s grammar: one MATCH of one node, with or without a property map, then WHERE, WITH and RETURN with ORDER BY, SKIP and LIMIT. There is no arithmetic, so history passes `limit + 1` as a parameter of its own. History's query and the shared key lookup are both of this kind.
  2. **The declared types' read,** in the ADR's shape (F5). Its RETURN reads `….tapestryKey` and `….value`.
  3. **`MERGE (a)-[r:TYPE]->(b)`,** with `a` and `b` found by tapestryKey, through `{tapestryKey: $p}` or `v.tapestryKey = $p`. It returns only `count(…)`, `v.tapestryKey`, `type(r)` or `r`, and the counters say whether it created the relationship.
  4. **A MATCH and `DELETE r`,** with an optional `RETURN count(r)`.
  5. **The entry's CREATE:** `CREATE (c:GraphChange:TapestryNode {…})`, whose map values are parameters, `randomUUID()` or literals. It may be followed by `SET c.p = …`, which removes the property when null, and by `RETURN c` or `RETURN c.p AS …`.
- **What the tests pin where the ADR left a choice:**
  - `src/operations/graph.js` exports an object whose `writeTransaction` and `read` the harness replaces.
  - `src/operations/rules/index.js` exports `loadRules()` and `findRule(name)`.
  - A rule's `violations` answers `[{ item, code, message }]`.
  - A refusal's message names the reserved type and what makes it, in the ADR table's words: create-concept, link-set, add-to-concept, add-property, enumerate, import nostr, trust pipeline, tagging-edges, copy-node, merge-nodes, cards, second brain. The message for a missing concept says "relationship type" and "concept".
  - The list entry's `guards` is the rules' names, and `repeatKey` the inputs. `/docs` names the guards and says "Safe to repeat by …".
  - A guard's refusal carries `rule`, and `unknown-node` carries `input`.
  - A change entry answers `{ id, at, by: { role, pubkey }, operation, changes }`, and a removal's change carries `count`.
  - The writes answer `{ relationship, outcome, change }`, with outcomes added, already-there, removed and already-gone. History answers `{ entries, cursor }`, where the cursor is an opaque string, and a bad one gets 400 `invalid-cursor`.
  - `ensureChangeIndexesOnBoot({ runWrite, runRead, log, sleep, windowMs })` lives in `src/lib/tapestry-node-index.js` or a sibling there. It is called from `bin/control-panel.js` as `require('../src/lib/<module>').ensureChangeIndexesOnBoot(…)`, as `ensureUuidIndexOnBoot` is.
- **Firmware state:** none needed. The seeded graph holds what the rule reads.
- **The branch:** the tests are on `A10.4-write-path`, a feature branch off `staging`. That is Loom's branch for the task, as A10.3's was. Never on `staging` or `main`.

## The live check (at Implementation, on a scratch stack)

Never on a shared or private instance. Run on throwaway instances from `scripts/scratch-stack.sh`, with every step and number recorded under Verification. These are the ADR's list, with the edge cases above.

1. **Declare a type.** Declare CITES through today's `POST /api/normalize/create-element` on the relationship type concept. Then add, repeat and remove CITES between two nodes, checking `MERGE`'s counters against the graph.
2. **Two at once.** Two calls of the same add at once make one relationship and one entry.
3. **A rollback.** Force a failure after the change (an invalid entry write, made by hand in a scratch build only). No edge and no entry are kept.
4. **The indexes.** `graph_change_at` and `graph_change_by` are online after the control panel's restart.
5. **History at size.** With 100,000 entries, record history's plan (PROFILE) and its time, unfiltered and filtered by node.
6. **Backup and restore.** With entries before and after a `lifecycle backup`, a `lifecycle restore` brings back exactly the history of the restored graph. The entries also survive a restart of the control panel.
7. **The relay.** Its event count is unchanged across every write (AC6).
8. **The agent.** An admin agent does all three through the external CLI, on the scratch instance.
9. **The firmware.** A `POST /api/firmware/install` leaves a CITES relationship in place.

## How to run

```
node test/operations/write-path.test.js
node test/operations/rules/relationship-type-allowed.test.js
node test/operations/graph/add-relationship.test.js
node test/operations/graph/remove-relationship.test.js
node test/operations/graph/history.test.js
node test/operations/change-indexes.test.js
node test/operations/graph/agent-through-cli.test.js
node test/operations/graph-fake.test.js
```

All of them, with the suites of the operations module they join: `node test/operations.test.js`. The full gate is `npm test`, which runs in CI on the pull request.

## Verification

The new tests fail with the current code, each for the reason it names. Confirmed on 2026-11-14 with `node test/operations.test.js`, on `f077badb` (staging, with the story and the ADR) plus these tests:

```
operations: the change entries' indexes: 0 passed, 3 failed, 0 skipped
operations: the fake graph: 7 passed, 0 failed, 0 skipped
operations: graph add-relationship: 0 passed, 12 failed, 0 skipped
operations: an admin agent through the external CLI: 0 passed, 1 failed, 0 skipped
operations: graph history: 0 passed, 8 failed, 0 skipped
operations: graph remove-relationship: 0 passed, 7 failed, 0 skipped
operations: rule relationship-type-allowed: 0 passed, 10 failed, 0 skipped
operations: the write path: 0 passed, 13 failed, 0 skipped
(every lifecycle suite, the cache counts and the tapestry keys: all passed)
operations: 208 passed, 54 failed, 0 skipped
```

Why each fails:

- **Against today's code**, which runs and is wrong:
  - W1–W3: the loader accepts a graph write with `run`, and refuses `apply` as "it has no run function".
  - W11: a `run` write sent as text/plain answers 200.
  - W11b: a body-less POST to lifecycle backup takes a real backup: "got 200 … backup 20261114T161310Z-…".
  - W12: route "graph cant-serialize failed: it will not serialize", command "graph cant-serialize failed: undefined".
- **On a module that doesn't exist yet,** named with its decision:
  - W4–W10 and X1: "src/operations/graph.js does not exist yet (ADR graph-operations-foundation/0004 Decision 9)".
  - R1–R9: "src/operations/rules/index.js does not exist yet (… Decision 4)".
  - R10: "docs/GRAPH_RULES.md does not exist yet (… Decision 12)".
  - AR1–AR12, RR1–RR7 and H1–H8: "src/operations/catalog/graph/<name>.js does not exist yet (… Decision 7)".
  - I1–I3: "no module in src/lib/ exports ensureChangeIndexesOnBoot(…) yet (… Decision 5)".
- **The fake graph's own suite passes** (F1–F7), so the suites above fail for the graph's reasons, not the fake's.

The helpers' other users still pass: `node test/external-cli.test.js` gives 53 passed and 0 failed, after `externalCliServer.js`'s change. The lifecycle suites above pass after the harness's and `nodeCypherFake.js`'s.
