# Test Plan: Story 43 — A rename or a field mark beside a property write on the same concept go one after the other

**Story:** `engineering-team/stories/graph-operations-first-slice/43-concept-writes-take-header-lock.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md` (Decision 11; Amendment 3, item 1; Amendment 4, at test design)
**Date:** 2026-11-18

The suite is stack-free, like story 18's. It runs the real catalog in a child process (`test/helpers/operationsHarness.js`), over the fake graph (`test/helpers/graphFake.js`), with every service endpoint dead. Its seed is `test/helpers/propertyGraph.js`'s, and every case works on lamp, a concept `graph create-concept` made there.

The fake runs one transaction at a time, so two writes can't truly run at once in it. The suite stands one in for the other with the fake's new failure, `failures.meanwhile` (ADR Amendment 4, item 4):
- the other write runs first, over a copy of the state;
- the graph it left is committed just before the write under test first writes lamp's header.

That is what Neo4j does when the other write holds the header: the statement waits for its lock, then goes on over what the other write committed. A write that never writes lamp's header never meets the other write, which is how the bug shows in the fake. The live check runs the same races for real (below).

No suite pinned either write's first statement before this story. Ledger row `2026-11-17-concept-writes-skip-header-lock` expected some to need changing (update-concept's lock, mark-field's MERGE). A search of `test/operations/` finds pins on the first statements of create-concept (CC13) and add-property (AP10), and on delete-node's and unlink-set's own lock order, but none on either of these two writes. So no existing case changes. HL1 and HL5 are the new pins.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: a rename beside a property write keeps both | **HL1:** right after C1, update-concept's next two statements set and clear the lock on lamp's own header, with no read between. **HL2:** a rename to lantern, with add-property of weight committing while it waits for lamp's header. The header, schema node, primary property and tree graph end exactly as add-property then the rename, one after the other, leave them. weight is in the schema node, the primary property and the tree. The next property write takes no property node out. **HL3:** the same for a rename of the plural alone, which writes no header node. **HL4:** a rename, then add-property, one after the other: the property write keeps every value the rename changed, and adds weight everywhere. **L1, L1b:** the races, live. | `test/operations/graph/concept-writes-take-header-lock.test.js`; live | integration (fake); live |
| AC2: a mark beside a property write follows the rules either way round | **HL5:** mark-field's first two statements that write set and clear the lock on lamp's header, before its MERGE. The rule `field-mark-allowed`'s reads before the lock run again, in order, right after it. **HL6:** a mark of color, with update-property's change of color to an object committing while it waits: refused 409 `not-plain`, `rule: field-mark-allowed`, its message naming an object. The graph is exactly as the type change left it: no mark, no copies, no change entry. **HL7:** the same with remove-property of color: refused 404 `unknown-field`, and the graph is exactly as the removal left it. **The mark first:** story 18's UP8 (`r-marked-type`, `r-marked-items`) and RM7 (`r-marked`) refuse a type change and a removal of a marked field `marked-field`. With the lock, one after the other is the only order the two can land in. **L2, L2b:** the races, live. | the suite; `test/operations/graph/update-property.test.js`, `remove-property.test.js`; live | integration (fake); live |
| AC3: alone, each write is as it was | The two writes' own suites pass unchanged: `update-concept.test.js` (UC1–UC11) and `mark-field.test.js` (16 cases). So do the suites that call them: `create-concept.test.js`, `fields.test.js`, `fields-agent-through-cli.test.js`, `map-fields.test.js`, `unmark-field.test.js`, and story 18's four with `properties-agent-through-cli.test.js`. HL1 and HL5 pin that the node locked is the concept's own header and no other, so neither write waits for a write on another concept beyond update-concept's C1. **L3:** a mark beside update-node of one of the concept's elements, live: both land, neither answers 500 (ADR Amendment 4, item 3). | those suites, through the scoped gate; live | integration (fake); live |
| AC4: the records say it holds | The review reads ADR 0018's Decision 11 and Amendment 4, and the ledger row's Status. | — | review |

## Edge cases

- [x] **A rename of the plural alone** writes no header node, so before this fix nothing at all made it wait for a property write (HL3).
- [x] **A rename that changes a slug or a description** takes the same lock in the same place, since the lock doesn't depend on the field. HL1 pins its place for a name.
- [x] **The rule's second run refuses as the guard does:** the rule's code, its message and `rule` (HL6, HL7). A field the concept never had, or one that isn't plain, is still refused by the guard before the lock (MF6).
- [x] **A refused mark undoes nothing of the other write.** HL6 and HL7 compare the whole graph after with the graph the other write left.
- [x] **The fake's new failure itself** (HL0): it fires once, at the first lock or copies statement naming its node, never at a read or at a statement on another node. A rollback keeps its graph. It refuses a transaction that has already written, since the fake can't merge two writes.
- [x] **`graph unmark-field` and `graph map-fields`,** which take no header lock either. Read against the property writes, the Tester finds no harmful interleaving:
  - **unmark-field's removal of a mark.** A property write that reads the mark before it goes refuses `marked-field`, as it would one after the other. One that reads after it lands. unmark-field reads nothing a property write may change, since a marked field's type and presence can't change.
  - **map-fields's copies** are of marked fields only. A property write may change a marked field's description, never its type, so no copy depends on what a property write changes.

  So the story's out of scope holds, and no ledger row is needed.
- [x] **A deadlock between a mark and an element write.** The fake can't reach it: it runs one transaction at a time, and has no locks. L3 runs it live. ADR Amendment 4 item 3 says why it resolves: Neo4j fails one write with a transient error, and the driver runs that write again.
- [x] **Concurrent calls:** L1–L3, live.
- [x] **Concept Graph API unavailable:** the suite is stack-free, and the live check runs on a scratch stack.

## Test infrastructure

- **Runner:** Node's, through the suite's exported `run()`. `test/operations.test.js` runs every suite under `test/operations/`, so the suite needs no line in `test/registry.js`.
- **The seed:** `test/helpers/propertyGraph.js`'s `prepare(label)`, twice: once for the renames (HL1–HL4) and once for the marks (HL5–HL7), where add-property gives lamp the field `color`, a string. Each case works on its own copy of the state file, beside the original, so the store under the directory is shared and the graphs are not.
- **The fake learns one failure,** `failures.meanwhile { at, graph }`, documented in its header (ADR Amendment 4, item 4). It changes nothing for a state without it: the fake's own suite, `graph-fake.test.js`, and the neighbours that use its other failures (`delete-node.test.js`) pass as before.
- **Firmware state:** none on a live instance.

## How to run

The suite alone, stack-free, with nothing able to reach the agent-memory instance:

```bash
TAPESTRY_CONTAINER=no-such-container BRAINSTORM_BASE_URL=http://127.0.0.1:9 \
  node test/operations/graph/concept-writes-take-header-lock.test.js
```

The scoped gate, for the review's `gate:status` line, runs CI's own registry entries for an operations change. That is `operations.test.js` (which runs this suite and its neighbours) with `external-cli.test.js`, `openapi-coverage.test.js`, `admin-action-sweep.test.js` and `schema-save-finds-the-right-header.test.js`, through `test/helpers/gateRunner.runGate`, with every endpoint on a dead port and `TAPESTRY_CONTAINER=no-such-container`. It never lists `operations.test.js` beside the suites it runs. Never run the full `npm test` on the Mac Studio, whose stack is the agent-memory instance. The pull request's CI runs the full gate.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

Each race runs several times, each time on a fresh concept made by `graph create-concept`. The two calls are fired at once through the scratch container's loopback, the second a few milliseconds after the first, with the delay varied across the runs, so it lands inside the first write's transaction.

- **L0, before the fix:** the races below on staging's code (this branch at the failing tests' commit), to show the check can see the bug. It records how many runs lost a write. The fix's run is the one the story needs. If L0 finds no loss in its runs, that is reported as it is, and shows the window is narrow.
- **L1:** a rename (`name`) beside add-property. Both answer 200, the schema node lists the new property, the header has its new name, and the next property write takes nothing out (`caughtUp.removed` empty).
- **L1b:** the same for a rename of the plural alone.
- **L2:** a mark beside update-property's change of the field to an object. Exactly one of the two lands, and the other is refused, `marked-field` or `not-plain`. Never both, and never a marked field whose type a mark can't carry.
- **L2b:** a mark beside remove-property of the field. Exactly one lands, and the other is refused `marked-field`, or `unknown-field` or `no-property-node`. Never a mark's copy on an element with no mark.
- **L3:** a mark beside update-node of one of the concept's elements. Both answer 200, so a deadlock between them, if Neo4j finds one, is run again by the driver and never reaches the caller.
- **L4:** the relay's event count is unchanged throughout: nothing is signed.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-18 on branch `A10.18.a-header-lock`: staging at `02e21816` (story 18 merged), with the story's commit `d8d1f040`, and this suite, the fake's new failure and this plan uncommitted beside it. The suite was run alone, as above:

```
  PASS  HL0: the fake's failures.meanwhile fires once, at the first statement that writes its node, commits its graph, and refuses to merge
  FAIL  HL1: … its next two statements set and clear the lock on lamp's own header …; got [lock, copies over the header and four tags, create]
  FAIL  HL2: … weight is in lamp's schema node, primary property and tree; got {"schema":false,"primaryProperty":false,"tree":true}
  FAIL  HL3: … the plural's rename never waited for lamp's header (no failures.meanwhile in its transaction) …; the log: [["lock","tx.read","tx.read","copies:29","create"]]
  PASS  HL4: a rename, then add-property, one after the other: the property write keeps the rename's names
  FAIL  HL5: … then it MERGEs the mark; got [merge, create]
  FAIL  HL6: … mark-field never waited for lamp's header …; the answer: {"status":200,…"outcome":"marked"…}
  FAIL  HL7: … mark-field never waited for lamp's header …; the answer: {"status":200,…"outcome":"marked"…}

operations: a rename or a mark beside a property write takes the header lock: 2 passed, 6 failed, 0 skipped
```

Each fails for the reason the fix isn't built:
- **HL2 is the bug itself, in the fake.** The rename's one write statement waits for lamp's header. Then it writes the json tags it built from what it read before add-property committed. weight's node is in the tree, but the schema node and the primary property have lost it. The review's finding 1 described exactly this.
- **HL1, HL3 and HL5–HL7:** neither write takes the header's lock.
- **HL0 and HL4 pass, as they should.** HL0 tests the fake. HL4 is the order the property writes already handle: the rename first, then the property write.

The neighbours pass with the fake's change: `graph-fake.test.js` 31/0, `update-concept.test.js` 11/0, `mark-field.test.js` 16/0, `delete-node.test.js` 40/0.
