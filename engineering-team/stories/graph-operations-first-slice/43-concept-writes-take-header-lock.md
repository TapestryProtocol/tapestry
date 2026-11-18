# Story 43: A rename or a field mark beside a property write on the same concept — the two go one after the other, and neither is lost

**Status:** Done
**Created:** 2026-11-18
**Type:** Bug
**Loom:** A10.18.a — https://loom.brainstorm.world/t/A10.18.a

## Background

Story 18 (Loom A10.18) built the four property writes, `graph add-property`, `update-property`, `remove-property` and `set-schema`. Each holds the concept's header from its first write to its commit, as the element writes and `graph delete-node` do. So those writes to one concept go one after the other, and the second reads what the first wrote (ADR graph-operations-first-slice/0018, Decision 11).

Two other writes to a concept don't hold its header, and story 18's review found that either can interleave with a property write (review round 1, non-blocking 1). It was found by reading the code. No suite shows it, since the fake graph runs one transaction at a time. ADR 0018 records it as a known limit (Amendment 3, item 1), and ledger row `2026-11-17-concept-writes-skip-header-lock` holds it open.

- **`graph update-concept`'s rename.** It holds the concept-header concept's header, which every concept write holds, but not the header of the concept it renames. It reads the concept's core nodes, then writes the json tags of the schema node, the primary property and the property tree graph from what it read, wherever they still hold the old names' text.
  - Beside a property write, it can write back what it read before that write committed. The schema node then loses the property write's change.
  - The next property write's catching up then follows the schema, and takes the new property's node out. The node is kept whole in that write's change entry.
  - A rename of the plural alone writes only tag nodes, so either write's change to those json tags can be the one lost.
- **`graph mark-field`.** It holds nothing of the concept. A type change or a removal can land on a field marked between the property write's read of the marks and its commit. Decision 8 refuses that change when the two run one after the other. After a removal, the mark's copies stay on the elements with no mark; `graph map-fields` clears them.

Both need the owner or an admin to run two writes on one concept at once, and the change entries keep what was lost. ADR 0018 Amendment 3, item 1, gives the fix: each of the two holds the concept's header before it reads, after any lock of its own, as the property writes do.

## User-facing description

As the owner, or an admin's agent working a concept, I want two writes to one concept to land one after the other, whichever comes first, with the second seeing what the first did. A rename, a field mark and a property change are among those writes. Then running two of them at once never loses one, and never leaves the concept's schema, its property nodes and its field marks disagreeing.

## Acceptance criteria

- [ ] **AC1 — A rename beside a property write keeps both.** `graph update-concept` changes a concept's name, its plural, or both. While it runs, a property write on the same concept is in flight (`add-property`, `update-property`, `remove-property` or `set-schema`). Then both land:
  - the concept has its new names, and the schema node, the primary property and the tree graph read them, wherever they held the old names' text;
  - the schema node, the property nodes and the tree graph keep the property write's change;
  - the next property write on the concept takes no property node out.

  For example, rename `lamp` to `lantern` beside `add-property weight`: the schema lists `weight`, and the concept is named `lantern`. Whichever of the two commits second sees what the first wrote.
- [ ] **AC2 — A mark beside a property write follows the rules either way round.** `graph mark-field` marks a field while a property write on the same concept changes that field's type or takes it out. The two go one after the other:
  - **the mark first:** the property write is refused `marked-field` (409), as when the two run one after the other (ADR 0018, Decision 8), and changes nothing;
  - **the property write first:** mark-field judges the field as the property write left it. Where the rule `field-mark-allowed` refuses that field, mark-field refuses it with the rule's own code and message (such as `not-plain`, `unknown-field` or `no-property-node`), and writes nothing: no mark, no copies, no change entry.

  So a marked field never has a type a mark can't carry, and no element keeps a mark's copies without the mark.
- [ ] **AC3 — Alone, each write is as it was.** Run alone, `graph update-concept` and `graph mark-field` give the same answers, refusals, writes and change entries as before this story. Neither waits for a write on another concept, except that `graph update-concept` still goes one at a time with `graph create-concept` and other `graph update-concept` calls, on any concept, as today.
- [ ] **AC4 — The records say it holds.** ADR 0018 no longer lists the two writes as a known limit of Decision 11, and ledger row `2026-11-17-concept-writes-skip-header-lock` is closed.

## Concepts touched

`<TA>` is the instance's assistant (`GET /api/assistant/pubkey`).

- `39998:<TA>:concept-header` — concept header (its header is the lock every concept write takes first; unchanged).
- Any of the instance's own concepts: its header, JSON schema node, primary property, property tree graph and property nodes (written by a rename and by the property writes).
- `39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields` — the set a mark makes its property node an element of (written by mark-field; read by the property writes).

## Out of scope

- **`graph unmark-field` and `graph map-fields`,** which don't hold the concept's header either. Whether either can interleave harmfully with a property write is the Tester's and Reviewer's to check. If one can, it gets a ledger row of its own, not a fix here.
- **Two writes on different concepts:** they don't conflict, and nothing here makes them wait for each other.
- **Making the fake graph run transactions at once.**
- **Restoring what an interleaving lost before this fix:** the change entries hold it.

## Open questions

- None that block planning.

## Deviations

- **No suite pinned either write's first statement,** though ledger row `2026-11-17-concept-writes-skip-header-lock` said suites pinning update-concept's lock and mark-field's MERGE would follow. So no existing case changed. The new suite's HL1 and HL5 are the pins (test plan, opening).
- **mark-field runs `field-mark-allowed` again after the lock** (ADR 0018 Amendment 4, item 2). The row's fix said each write takes the lock "before it reads". The write path runs a guard before apply, so mark-field's guard has read before the lock can be taken, as Amendment 1 item 6 found for the property writes. The rule's second run, after the lock, is what judges the field as a property write left it.
- **A mark now holds the header while it writes copies onto elements,** the other way round from update-node and delete-node, so a mark and an element write on one concept can deadlock. Neo4j fails one, and the driver runs it again (Amendment 4, item 3). The live check's L3 runs the pair. Before the fix, that pair left a stale copy on the element (L0); with it, the two go one after the other.
- **The rulebook's entry 3 keeps its "Enforced by"** (Amendment 4, item 5). Changing it would change firmware's rule 3 element, and need a reinstall on each instance, for wording alone.
- **The fake graph learns one failure,** `failures.meanwhile` (Amendment 4, item 4), which stands for another write that held the concept's header.

## Evidence

### The suites (Implementation, 2026-11-18)

Run on this Mac, each with every service endpoint dead and `TAPESTRY_CONTAINER=no-such-container`. No full `npm test` ran here: the local stack is the owner's agent-memory instance, and the PR's CI runs the full gate.
- **The new suite alone:** `concept-writes-take-header-lock` 8/0. Before the fix it was 2/6, each failure for the reason the test plan's Verification gives.
- **The two writes' own suites alone,** unchanged: update-concept 11/0, mark-field 16/0.
- **The suite catches each half of the fix.** Two scratch edits, each undone and compared byte for byte with the fix:
  - mark-field with its lock but no second run of the rule: HL5, HL6 and HL7 fail. HL7 answers 500, the error for a property node that went missing after the guard passed.
  - update-concept with its header lock moved after its first read of the concept: HL1, HL2 and HL3 fail.
- **The scoped gate,** through the gate engine: CI's registry entries for an operations change, `operations.test.js` (which runs every suite under `test/operations/`), `external-cli`, `openapi-coverage`, `admin-action-sweep` and `schema-save-finds-the-right-header`. Every endpoint was dead, Node 24.18.0. `npm run gate:status -- --label a10-18-a-story-43-impl` reads:
  `20261118T062428Z-3327-01e6 [a10-18-a-story-43-impl] started 2026-11-18T06:24:28.193Z on dd06b640+dirty — PASS, exit 0, 1024 passed, 0 failed, 6 skipped, 5/5 suites`
  - **Dirty** is four files: the fix's two and ADR 0018's note, committed while the gate ran as `5c35826e` and `9c02d6f1` with the same content, and this file's Deviations.
  - **Per suite:** operations 923/0/4, external-cli 53/0/0, openapi-coverage 13/0/0, admin-action-sweep 9/0/0, schema-save-finds-the-right-header 26/0/2.
  - **Inside operations:** this story's suite 8/0. Its neighbours: update-concept 11/0, mark-field 16/0, unmark-field 13/0, map-fields 12/0, rule field-mark-allowed 14/0, update-node 42/0, the property writes (add 15/0, update 11/0, remove 8/0, set-schema 10/0), create-concept 23/0, delete-node 40/0, and the fake graph's own 31/0.
- **harness-lint** is clean.

### The live check (Implementation, 2026-11-18)

It ran on a throwaway instance from `scripts/scratch-stack.sh`, never a shared or private one. Every call went through `test/helpers/scratchLoopback.js`, which refuses any container not named `tapestry-scratch…`. The records are in this worktree's `tmp/live-check-43/`, which git ignores:
- the scripts: `live.js` and `deadlock-probe.js`;
- the reports: `report-before-run1.json`, `report-before.json`, `report-after.json` and `report-probe.json`;
- the logs: `before-run1.log`, `before.log`, `after.log`, `probe.log`, `up.log` and `gate-impl.log`.

- **The instance.** It booted from image `agent-memory-tapestry:latest`, with this worktree's `src/` mounted read-only.
  - The image's firmware differed from the branch's (digests `c4c302955e90` and `ef7fb29d1a09`). The branch only adds story 41's graph-rule concept and changes the manifest.
  - The branch's firmware was copied over the image's (`ef7fb29d1a09` after), the control panel was restarted, and the firmware was installed again.
  - The instance's assistant was `e0806a31…`. The agent-memory `tapestry` container (assistant `2a1b0fea…`) was up throughout and never touched.
- **The races.** Each race's two writes were fired from one node process inside the container, the second a set delay after the first: 0–400 ms for the renames, 0–180 ms for the marks.
  - Each race had ten runs, each on a fresh concept that `graph create-concept` made.
  - Each report stamps the code it ran: the two changed files' hashes here and as mounted in the container, the same in both places.
  - "Before" is staging's code, at the failing tests' commit `dd06b640`. "After" is the fix: its two files hash to `3685063f…` and `48194479…`, as in `5c35826e`.

| Race | Before the fix | With the fix |
|---|---|---|
| **L1:** a rename beside add-property of weight | 9 of 10 lost weight from the schema node and the primary property, its node left in the tree, and the next property write took that node out | 10 of 10 kept both, and the next property write took nothing out |
| **L1b:** a rename of the plural alone beside it | 10 of 10 lost weight the same way | 10 of 10 kept both |
| **L2:** a mark beside update-property of the field to an object | 5 of 10: both landed, so a marked field held an object | 10 of 10: one landed. The mark was refused `not-plain` 7 times, and the type change `marked-field` 3 times |
| **L2b:** a mark beside remove-property of the field | 3 of 10: both landed | 10 of 10: one landed, with `unknown-field` 7 times and `marked-field` 3 times |
| **L3:** a mark beside update-node of an element, red to blue | 6 of 10: the element kept the copy red while its JSON said blue | 10 of 10: blue, and every call answered 200 |
| **L4:** the relay's event count | unchanged | unchanged |

- **Where the rename waited.**
  - Before the fix, 17 of the 20 renames ended within 2 ms of the add beside them. Each one's write statement had waited for the header, with its read already made, then written from that read. The other three started at 300 or 400 ms, near the add's end.
  - With the fix, every rename ended after the add, by 92–98 ms (L1) or 235–254 ms (L1b). It waited for the header before it read, then did its work.
- **The first before-run** (`report-before-run1.json`) had a fault in L1b's check of the plural. It read the names tag's `value`, which holds the singular, while the plural is in `value1`. So it reported each plural rename lost. The second run fixed the check and found every rename landed. The two runs agree otherwise.
- **L3's deadlock, seen** (`deadlock-probe.js`, `report-probe.json`). Neo4j Community writes no query log, so a probe recorded it instead.
  - It made twelve runs of the real mark-field and update-node, through `src/operations`' `callOperation` inside the container. The seam's `writeTransaction` was wrapped, per call, to count each write's transaction runs and record each error's code.
  - In one run (run 8: the mark first, update-node 130 ms after), update-node's transaction failed with `Neo.TransientError.Transaction.DeadlockDetected`. The driver ran it a second time, and it answered 200 at 1,818 ms, with the copy blue.
  - In all twelve runs, every call answered 200 and every copy is blue. So ADR 0018 Amendment 4 item 3 holds as written.

## Linked artifacts

- ADR: `engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md` (Decision 11; Amendment 3, item 1; Amendment 4). Architecture is skipped: the fix's shape is decided there.
- Test plan: `engineering-team/stories/graph-operations-first-slice/43-concept-writes-take-header-lock.test-plan.md`
- Review: `engineering-team/reviews/graph-operations-first-slice/43-concept-writes-take-header-lock.md`
