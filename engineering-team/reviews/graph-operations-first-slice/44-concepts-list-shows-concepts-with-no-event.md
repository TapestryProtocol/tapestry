# Review: Story 44 — The Concepts page and the Dashboard show a concept with no event

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-18
**Diff:** `git diff 3b7ae010...HEAD`. `3b7ae010` is staging; branch `fix/concepts-list-eventless-concepts` adds three commits: `be5f2301` (story), `6842af3d` (failing tests), `ab25a9a2` (the fix, at HEAD). 11 files, +643 −9.
**Inputs:** story `engineering-team/stories/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.md` (AC1–AC4, Out of scope, Deviations, Evidence); test plan `44-concepts-list-shows-concepts-with-no-event.test-plan.md`; ADR graph-operations-first-slice/0016 (Consequences); ADR graph-operations-foundation/0003 Decision 9, with its guard `test/operations/lifecycle/tapestry-key-paths.test.js` (G11, G18) and kept-list `test/operations/lifecycle/nostr-event-lookups-kept.json`; ADR shared-concepts-seeding/0002, which Blocking 1 turns on.
**Type:** bug. Architecture was skipped (David, 2026-11-18); the test plan fixes the one interface, the row field `hasEvent`.
**Independent check** (workflow 5, optional): not applied.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, scoped.** I didn't run the full gate. On this Mac the local `tapestry` container is the owner's agent-memory instance, and some suites write to it; the PR's CI runs the gate whole. I chose 16 registry entries myself: every one that reads a file this diff changes, plus the record linters that read the new ledger row.
  - **The entries:** this story's suite; `not-yet-shared-filter`, `list-headers-disposition-column`, `share-from-shared-by-me`, `b-coverage-audit-and-disposition` and `concept-count-canonical` (the page and the filter); `admin-tools-dashboard-panel`, `assistant-setup-state`, `one-default-assistant-profile`, `one-writer-assistant-profile` and `tagging-edges-wiring` (the Dashboard); `openapi-document` and `stack-free-npm-test` (the registry); `operations.test.js`, which runs every suite under `test/operations/`, `tapestry-key-paths` among them, so none of those was listed alone; `harness-lint` and `ledger-row-ids` (the new ledger row).
  - **Left out:** `session-start`, whose digest probes `localhost:7778` whatever the env says (Harness friction 2).
  - **The run:** through the gate engine, every endpoint dead: both base URLs, the panel and container ports, Meilisearch, the relay, Redis and the concept graph at port 9, and `TAPESTRY_CONTAINER=no-such-container`. Node 24.18.0. `node test/gate-status.js --label story-44-review` reads:
  `20261118T163031Z-69689-4dce [story-44-review] started 2026-11-18T16:30:31.277Z on ab25a9a2+dirty — PASS, exit 0, 1423 passed, 0 failed, 28 skipped, 16/16 suites` (record `tmp/gate-runs/20261118T163031Z-69689-4dce.json`)
  - **Dirty by one path:** the record's `dirtyCount` is 1, and `git status --porcelain` shows only `?? node_modules`, the link to the main checkout's packages. So the code under test is `ab25a9a2`. The Implementer's passing gate ran on `6842af3d+dirty`, before the fix was committed, so this is the first gate on the committed fix.
  - **Per suite:** operations 1041/0/4, tagging-edges-wiring 87/0/0, harness-lint 85/0/0, one-default-assistant-profile 55/0/0, assistant-setup-state 26/0/2, b-coverage-audit-and-disposition 18/0/8, one-writer-assistant-profile 17/0/0, not-yet-shared-filter 15/0/2, share-from-shared-by-me 15/0/0, concept-count-canonical 12/0/7, list-headers-disposition-column 12/0/0, openapi-document 10/0/0, admin-tools-dashboard-panel 9/0/0, this story's suite 9/0/4, ledger-row-ids 6/0/0, stack-free-npm-test 6/0/1. They sum to 1,423/0/28. That is the Implementer's 1,332/0/28 plus harness-lint and ledger-row-ids (91), with the same 28 skips.
  - **Inside operations:** G11, G18 and G19 each PASS.
  - **Every skip is a live check:** the H, L and LK classes, and `stack-free-npm-test` G2, which skips when no panel answers.
- [x] **The Implementer's two gate lines, checked against their records.** `node test/gate-status.js --label story-44-impl` and `--label story-44-impl-2` read word for word as the story's Evidence quotes them: FAIL 1328/4/28, then PASS 1332/0/28, both on `6842af3d+dirty`.
- [x] **The new suite alone, stack-free,** with the same dead endpoints: 9 passed, 0 failed, 4 skipped, the L class among the skipped. Under Node 22.23.1, CI's major version: 9 passed, 0 failed, 4 skipped.
- [x] **The new suite's live checks** on `tapestry-scratch`, which mounts this worktree's `src/` (`docker inspect`): 13 passed, 0 failed, 0 skipped. The other endpoints stayed dead, but `TAPESTRY_CONTAINER_PORT` was left at the helper's in-container default (Harness friction 1). The agent-memory `tapestry` container was never touched.
- [x] **The tests fail at base, and catch each part of the fix.** In a scratchpad tree holding only the six files the suite reads, I ran the suite stack-free each time. The worktree was untouched.

  | Tree | Result | Failing |
  |---|---|---|
  | HEAD as committed | 9/0/4 | none |
  | Base `3b7ae010` sources, suite from HEAD | 2/7/4 | U1, S1, S2, S3, S4, S5, S6 |
  | M1: the page's scan back to `NostrEvent` alone | 8/1/4 | S1 |
  | M2: the page's scan by `TapestryNode` alone | 8/1/4 | S1 |
  | M3: the filter without its event check | 8/1/4 | U1 |
  | M4: the tile back to `NostrEvent:ListHeader` | 8/1/4 | S3 |
  | M5: the Disposition cell without its no-event branch | 8/1/4 | S5 |
  | M6: Save & next without its event check | 8/1/4 | S4 |
  | M7: `hasEvent` dropped from the RETURN | 8/1/4 | S2 |

  The base row is the test plan's Verification exactly. M1–M6 are the Evidence's six edits, and each fails the stack-free test its table names. I didn't re-run its L columns under mutation.
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)`, exit 0, before this file existed. It was run again with this file in place (story still `In Progress`, verdict CHANGES_REQUESTED): `harness-lint: clean (0 violations)`, exit 0.
- [ ] `npm run test:playwright`: not run. The checkout has no `ui/node_modules`, and the test plan's V1 checks the rendered page on david.tapestry.ninja after the staging merge.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC1: listed | met | S1 (label sets), L1 and L4 live: the eventless concept has a row with `hasEvent` false, its name, the assistant as author and all eight core-node counts at 1. The row opens the concept's page: `ConceptDetail.jsx:57` finds the header by `MATCH (h:ListHeader {uuid: $conceptUuid})`, with no `NostrEvent`. It sorts by name: `ORDER BY h.name` is unchanged. The element, set and property counts aren't asserted (non-blocking 1), but they hold by trace. |
| AC2: counted | met | S3 and L2 live. The 48 on david.tapestry.ninja is V1's, after the merge. |
| AC3: no Disposition… without an event | met on the page | U1 (with its control), U2, S4, S5; mutants M3, M5 and M6. The Author filter's options are the rows' authors (`ConceptList.jsx:182-191`), and L1 shows the row's author is the assistant. But putting the row under Not yet shared (mine) changes what Shared by me's count means (Blocking 1). |
| AC4: everything else as before | met on the page and the tile | U3, S1 and S3 over headers with and without the shared label, L3 live, L4's exact set; mutant M2. |

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [ ] **No behaviour beyond the story: not met.** Before the diff, the page's not-yet-shared list and Shared by me's "waiting" count were drawn from the same population. After it they aren't, and the story doesn't say so (Blocking 1).

### The Deviations, checked

- **ADR 0016's dated note.** Holds. The page and the tile changed and no name lookup did (`0016…md:150`).
- **The Dashboard's kept entry stays, with a new reason.** Holds. The text `MATCH (n:NostrEvent:ListHeader)-[:IS_THE_CONCEPT_FOR]->()` now matches only the onboarding check (`Dashboard.jsx:728`), and G11 passes on it. The reason is true: `hasBios` is `conceptCount > 0` (`Dashboard.jsx:56`), and create-concept refuses `not-installed` when the firmware is missing (`_concepts.js:100`).
- **Nine lines left, in the ledger row.** Holds: 11 kept entries rest on "a header is always an event" at `3b7ae010`, and 9 at HEAD, in exactly the files and counts the row lists. One of the nine is misdescribed, though (Blocking 1).
- **`h:NostrEvent AS hasEvent` is a kept line.** Holds. G18's `ALONE` pattern matches it, and its reason ("about the event itself") fits the kept-list's own `about`.

## ADR adherence

No ADR for this story. Against the records it touches:

- [x] **ADR graph-operations-foundation/0003 Decision 9:** the page's scan now names `NostrEvent|TapestryNode`, and its one `NostrEvent`-alone line is kept with why. G11, G18 and G19 pass.
- [x] **ADR graph-operations-first-slice/0016:** headers made by create-concept have `ListHeader`, `ConceptHeader` and `TapestryNode` and no `NostrEvent` (L1's fixture reads `withEvent` false); their elements are `ListItem` (`create-element.js:166`), which the page's `explicitElem:NostrEvent|ListItem` admits (`ConceptList.jsx:26`).
- [ ] **ADR shared-concepts-seeding/0002: broken.** Its decision is that the count on Shared by me "cannot disagree" with the list it links to, "because they are one function over the same inputs" (`0002…md:58-59`, `:96-97`). This diff changes one of the inputs on one side only (Blocking 1).
- [x] No new dependencies, and no new tooling.

## Concept-graph integrity
- [x] Handles: none added or changed. The suite's live checks read the assistant's key at runtime (`S.taPubkey()`); the unit rows use a synthetic key.
- [x] Firmware: no concept definition changed, so there's nothing to reinstall.
- [x] Orientation: not applicable. The change is to two UI queries and a pure filter, in the page's existing `useCypher` pattern.
- [x] **Principle 4 (local-first):** the fix serves it. Graph state made locally, with no event behind it, is now listed and counted like any other.

## Things tests can't catch
- [x] No secrets, no debug logging, no commented-out code.
- [x] **A row that doesn't say:** `hasEvent !== false` and `=== false` treat a missing field as from an event (`ConceptList.jsx:176`, `:261`; `conceptStateFilter.js:116`), so the filter's other caller (`SharedByMe.jsx:86`) is judged as before (U3).
- [x] **`hasEvent` means what it says.** `event-less-nodes` strips `NostrEvent` only from nodes with no event id (`_migrations.js:312`). So a header from an event always reads true.
- [x] **No false rows.** Change records are `TapestryNode`s, but they have neither header label nor a `kind` (`changes.js:119`), so the page's `WHERE` drops them.
- [x] **Cost, measured rather than guessed.** I ran a read-only `EXPLAIN` inside the scratch container, through the scratch-only `sh()` of `scratchLoopback.js`. The plans read the header labels, not the wide ones:
  - **The labels on scratch:** `NostrEvent` 438, `TapestryNode` 3,214, `ListHeader` 46, `ConceptHeader` 40.
  - **The page's scan:** at base it's a `UnionNodeByLabelsScan` on `h:ListHeader|ConceptHeader`; at HEAD, two `NodeByLabelScan`s on the same two labels. Neither ever scans `NostrEvent` or `TapestryNode` for `h`.
  - **The tile's count:** an `IntersectionNodeByLabelsScan` (`NostrEvent&ListHeader`) at base becomes a `NodeByLabelScan` on `ListHeader`.
  - So the wider label costs nothing measurable.
- [x] Concurrency: not applicable (reads only).
- [x] Security: the queries are static templates (the suite holds them to that), with no input.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.
- [x] **No hardcoded TA pubkey:** the page uses `useConfig()`'s `taPubkey`.
- [x] **No `LEGACY_*` constant touched.**

## Product-guide adherence *(when the story traces to a PRD)*
- Not applicable: no PRD.

## Findings

### Blocking

1. **`ui/src/pages/shared-concepts/SharedByMe.jsx:40`: Shared by me's "waiting" count no longer matches the list it links to.**

   **What the count is for.** Shared by me counts the concepts still waiting to be shared. `POPULATION_QUERY` (`:39-44`) is the population, and `summarizeNotYetShared` (`:86`) does the counting. The page then renders one of two things:
   - "Haven't shared these yet — N waiting →", linking to `/tapestry/concepts?state=not-yet-shared` (`:46`, `:162-165`);
   - when N is 0, "✅ Nothing left to share — every concept here is either out with the community or deliberately kept back." (`:159-160`).

   **Why they agreed.** At `3b7ae010` that population's scan and the Concepts page's were the same two lines, `MATCH (h:NostrEvent)` / `WHERE (h:ListHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]`. The predicate (`conceptStateFilter.js:91-100`) is the same one too. So the count and the list agreed by construction, which is the property ADR shared-concepts-seeding/0002 chose Option A for:
   - "the count and the list it points at cannot disagree, because they are one function over the same inputs" (`:58-59`);
   - "a number advertising a list must not be able to disagree with it" (`:96-97`);
   - "Zero is a claim of completion" (`:108`).

   **What this diff does.** It widens the page's scan (`ConceptList.jsx:17`), and AC3 puts every concept with no event under Not yet shared (mine). It leaves Shared by me's scan on `NostrEvent` alone.

   **Measured on `tapestry-scratch`.** A read-only probe ran each page's own query from source and asked the shipped predicate each page's question, with nothing declared and the relay answering. The probe: `/private/tmp/claude-501/-Users-wds4-repos-TapestryProtocol-tapestry/58a7370b-cd30-4843-813c-de9c6a966f21/scratchpad/review-44/sharedbyme-probe.js`.
   - **Shared by me:** `{kind: 'waiting', count: 33}`.
   - **The list it links to:** 34 rows.
   - **The one extra:** `39998:b64e8dd2…:eventless-lantern`, with `hasEvent` false.

   **After the merge.** On david.tapestry.ninja, concept graph rule will be on the list and missing from the count. On an instance whose event concepts are all shared or kept private, Shared by me will say "Nothing left to share" while the list it stands for still holds every concept with no event.

   **Why the story didn't catch it.**
   - Its Out of scope doesn't name Shared by me (`44-…md:50-54`).
   - The record misreads the line. The test plan (`…test-plan.md:74`) and the new ledger row (`ledger/2026-11-18-kept-lines-claim-headers-always-events.md:18`) give "Shared by me lists only published concepts" as a ground for keeping it. But `:40` isn't the published list, which comes from `/api/shared-by-me`. It is the population of the not-yet-shared count. So the row points the next session at keeping the line for a reason that isn't true of it.
   - No test holds the two scans together: `share-from-shared-by-me` passes 15/0 over hand-built rows.

   **Asked change.** Make the count and the list agree again, and correct the record of that line. The fix that keeps AC3 as David approved it:
   - Widen `SharedByMe.jsx:40` to the page's scan, `MATCH (h:NostrEvent|TapestryNode)`.
   - Remove its kept entry (`nostr-event-lookups-kept.json:189-193`); G11 will call it stale once the line changes.
   - Take it out of the ledger row (nine lines become eight) and out of the test plan's "Left for a ledger row" (a dated note).
   - Add a stack-free test that holds Shared by me's population scan to the page's. For example, S1's `admits()` over the same four kinds of header, or the two `MATCH`/`WHERE` lines compared. A live check that the population lists the eventless concept would also help.
   - Record it in the story's Deviations.

   If David would rather keep concepts with no event off the seeding list, that changes AC3 and `isNotYetShared`, and it needs his ruling. Either way the two must agree.

### Non-blocking

1. **`test/concepts-list-shows-concepts-with-no-event.test.js:255-257`: L1 doesn't assert the element, set or property counts.** AC1's row "shows its name, author, counts of elements, sets and properties". L1 checks the eight core-node counts but not `elementCount`, `setCount` or `propertyCount`. They hold by trace: create-element's nodes are `ListItem` (`create-element.js:166`), which `ConceptList.jsx:26` admits, and the set and property walks name no `NostrEvent`. The concept that showed the bug has elements, so this is the count David will look at. Optional improvement: give the scratch fixture one element through `graph create-element`, and assert `elementCount` 1 and `setCount` at least 1.

### Harness friction *(each to be filed as a ledger row, type `meta`, by the calling session)*

1. **The dead-endpoint recipe silently skips the scratch checks.** The recipe sets `TAPESTRY_CONTAINER_PORT=9`, and `test/helpers/scratchLoopback.js:14` reads that variable as the control panel's port inside the scratch container. So keeping the recipe and swapping only `TAPESTRY_CONTAINER=tapestry-scratch` turns all four L checks into SKIPs, with the misleading reason "container 'tapestry-scratch' is unreachable via docker exec". The run still reads "9 passed, 0 failed, 4 skipped" and exits 0, so it looks like the live checks ran. Verified here. No ledger row or OPEN.md row names `TAPESTRY_CONTAINER_PORT`. Fix shape: the helper takes a variable of its own for the in-container port, or the recipe says to drop that one for scratch runs.
2. **`test/session-start.test.js` can't run with every endpoint dead.** `scripts/session-start.sh:41-47` probes `http://localhost:7778` (or `/etc/brainstorm.conf`'s port) and ignores `TAPESTRY_PORT`. `test/helpers/rollupFixtures.js:44` runs the real script with no curl stub. So on this Mac the suite GETs whatever answers at 7778, and a scoped gate that wants the ledger's readers has to leave it out, as this one did. It is the same class as `ledger/2026-11-05-suite-probe-reaches-private-container.md`, so a dated note on that row fits better than a new row.
3. **The worktree's `node_modules` link shows as untracked** (`?? node_modules`), so a `git add -A` would commit it. Already logged: OPEN.md row 199 and `ledger/2026-11-16-worktree-node-modules-link-untracked.md`. No new row.

## Verdict
**CHANGES_REQUESTED**

## Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-18
**Diff:** `git diff 4a92ecae..HEAD`, HEAD `dcb2a9c8`. `4a92ecae` is round 1's review. Three commits: `c37508a2` (round 1's cases, written before the fix and shown failing, with test-plan edits), `8865dabf` (the two harness notes) and `dcb2a9c8` (the fix, the kept-list, the ledger row, and the story's Deviations and Evidence). 8 files, +163 −22.
**Ruling:** David chose "count them": Shared by me's waiting count counts concepts with no event, and AC3 stands as approved (relayed by the coordinator, 2026-11-18).
**Independent check** (workflow 5, optional): not applied.

### A correction to round 1's gate account

Round 1 said its gate ran with every endpoint dead, and that it left `session-start` out because the digest that suite runs probes `localhost:7778`. Both statements were incomplete:
- **`ledger-row-ids` runs the same digest.** `test/ledger-row-ids.test.js:111` runs `scripts/session-start.sh` once per merge order, in the loop at `:102-111`, through `run()` (`:42-45`), which passes the gate's env and `PATH` through. The digest's probe is `curl -sf -m 2 http://localhost:7778/api/concept-graph/summaries -o /dev/null` (`scripts/session-start.sh:41-47`). The suite passed 6/0 in round 1, so both passes ran, and round 1's gate made the probe twice.
- **What answers there.** On this Mac, host port 7778 is the `tapestry` container's published panel port, the owner's agent-memory instance (`docker ps --filter publish=7778`; the host listener is Colima's SSH port forward). So two read-only GETs of the public summaries route reached it. Nothing was written, and the digest discards the answer.
- **How round 1 missed it.** Its stack-free check grepped the `harness-lint` and `ledger-row-ids` test files for `docker`, `curl`, `localhost` and `7778`. That misses a script a suite runs by path. Round 1's Harness friction 2 ("…has to leave it out, as this one did") is wrong for the same reason.
- **This round** put the coordinator's refusing stubs, `curl` and `docker`, first on `PATH` for every run with dead endpoints. Run alone that way, the digest prints "stack absent".

### Quality gates (round 2, run by reviewer, not trusted)

- [x] **`npm test`, scoped:** round 1's 16 registry entries, through the gate engine, with the same dead endpoints, the stubs first on `PATH`, and Node 24.18.0. `node test/gate-status.js --label story-44-review-round2` reads:
  `20261118T170416Z-2374-d76c [story-44-review-round2] started 2026-11-18T17:04:16.036Z on dcb2a9c8+dirty — PASS, exit 0, 1424 passed, 0 failed, 29 skipped, 16/16 suites` (record `tmp/gate-runs/20261118T170416Z-2374-d76c.json`)
  - **Dirty by one path:** `dirtyCount` is 1, the `node_modules` link, so the code under test is `dcb2a9c8`. The Implementer's round 2 gate ran on `8865dabf+dirty` (`dirtyCount` 4), before the fix was committed, so this is the first gate on the committed fix.
  - **Per suite:** each as in round 1, except this story's suite at 10/0/5 (S7 passes, L5 skips). That is 1,423 + 1 passed and 28 + 1 skipped. Inside operations, G11, G18 and G19 pass.
- [x] **The Implementer's quoted line** (`story-44-round2`) matches its record word for word.
- [x] **The suite alone, stack-free,** with the stubs: 10 passed, 0 failed, 5 skipped, under Node 24.18.0 and again under Node 22.23.1.
- [x] **The suite on `tapestry-scratch`,** without the stubs and with `TAPESTRY_CONTAINER_PORT` unset: 15 passed, 0 failed, 0 skipped.
- [x] **The key-path guard alone,** with the stubs: 20 passed, 0 failed, G11 and G18 among them.
- [x] **Round 1's probe, run again at HEAD** (read-only, `sharedbyme-probe.js`):
  - Shared by me's population has 46 rows, and so does the page.
  - Shared by me would say `{kind: 'waiting', count: 34}`, and the list it links to holds 34. Nothing on the list is missing from the count; in round 1 it was 33 against 34.
- [x] **The cases against edits.** These ran in a scratchpad tree holding only the eight files the suite reads; the worktree was untouched. "Stack" runs had every endpoint dead and the stubs on `PATH`. "Live" runs went to `tapestry-scratch`.

  | Tree | Stack | Live |
  |---|---|---|
  | HEAD as committed | 10/0/5 | 15/0/0 (the worktree run above) |
  | Before the fix: Shared by me and the kept-list at `4a92ecae` | 9/1/5: S7 | 13/2/0: S7, L5 |
  | Base `3b7ae010` sources, suite from HEAD | 3/7/5: U1, S1–S6 | not run |
  | R1: Shared by me's scan back to `NostrEvent` alone | 9/1/5: S7 | 13/2/0: S7, L5 |
  | R2: Shared by me's scan by `TapestryNode` alone | 9/1/5: S7 | not run |
  | R3: Shared by me's `WHERE` on kind 39998 only | 9/1/5: S7 | 14/1/0: S7 |
  | R4: the page's element walks on `NostrEvent` alone | 10/0/5 | 14/1/0: L1 |
  | M1: the page's scan back to `NostrEvent` alone | 8/2/5: S1, S7 | not run |
  | M3: the filter without its event check | 9/1/5: U1 | not run |
  | M7: `hasEvent` dropped from the RETURN | 9/1/5: S2 | not run |

  The before-the-fix rows match the test plan's new Verification exactly. R1, R3 and R4 are the Evidence's three edits, and each fails as its table says. At base S7 passes, which is right: both scans were `NostrEvent` then, so they agreed.
- [x] **Cost.** A read-only `EXPLAIN` of Shared by me's population query on scratch shows a `UnionNodeByLabelsScan` on `h:ListHeader|ConceptHeader` at `4a92ecae`, and two `NodeByLabelScan`s on the same labels at HEAD. So the wider label costs nothing measurable, as on the page in round 1.
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)`, exit 0, before this section.
  - **With it in place:** one violation, L1. This section's PASS is the review's last verdict, beside a story still `In Progress`, which is expected until the calling session flips the Status.
  - **With the flip:** in a `git archive` copy holding this file and the Status flipped to Done, `harness-lint: clean (0 violations)`.
- [ ] `npm run test:playwright`: not run, as in round 1.

### Round 1's findings

| Finding | Status | Evidence |
|---|---|---|
| Blocking 1: Shared by me's count no longer matched its list | resolved | `SharedByMe.jsx:42` scans `MATCH (h:NostrEvent\|TapestryNode)`, the page's own label expression (`ConceptList.jsx:17`), with the same `WHERE`. Its kept entry is gone, and G11 passes without it. The ledger row lists eight lines, and its false example is gone. The test plan has a dated note (`…test-plan.md:78`), and the story has a Deviation. S7 and L5 hold the two together, and both fail before the fix. |
| Non-blocking 1: L1 didn't check the element, set or property counts | resolved | The fixture makes one element with no event through `graph create-element` (`…test.js:293`). L1 asserts `elementCount` 1, `setCount` at least 1 and an integer `propertyCount` (`:312-314`). R4 shows the element check catches the walks losing `ListItem`. A repeat answers `already-exists` by name (`create-element.js:35`, `:136`), so reruns keep one element. |
| Harness friction 1: the container-port trap | filed | `ledger/2026-11-18-container-port-skips-scratch-checks.md`. Its claims hold: `scratchLoopback.js:14`, `scratchRefusal()` at `:19-31`, and round 1's run. The test plan and the suite's header now say to leave the variable unset. |
| Harness friction 2: the digest's probe | noted | A dated note on `ledger/2026-11-05-suite-probe-reaches-private-container.md`. It says round 1's gate made the probe once; it made it twice (non-blocking 1 below). |
| Harness friction 3: the untracked link | already logged | Nothing to do. |

**My own suggested wording, checked as fresh claims** (roles/reviewer.md, step 10):
- **The scan I suggested is right for Shared by me.** It admits all four kinds of header S1 judges. The population feeds only the waiting count (`SharedByMe.jsx:82-93`), so nothing else on the page changes, and the plan's cost is unchanged.
- **"`elementCount` 1 and `setCount` at least 1."** The first is a real check, as R4 shows. The second only shows that the superset is counted: the fixture has no subset, so a walk that dropped subsets would still pass. The set walk itself (`ConceptList.jsx:27`) is unchanged by this story and names no label, so that is enough here.

### The new tests and records, checked

- **S7** (`…test.js:250`) reads both scans from source. It compares their label expressions over S1's four kinds of header, then the `WHERE` after each first `MATCH` (`whereOf`, `:120`), with white space folded. It reads only the first line of a `WHERE`; both are one line.
- **L5** (`:365`) is round 1's probe made a test. It asks both pages' question with nothing declared and the relay answering, so no call leaves the machine, and it holds the count to the list.
- **The commits split by role.** `c37508a2` touches only the suite and the plan. `dcb2a9c8` doesn't touch the suite; its kept-list edit is the guard's data, which G11 requires.
- **The kept-list** has 37 entries, 8 of them on "a header is always an event", in exactly the files and counts the ledger row lists.
- **The story's round 2 Deviation and Evidence:** each claim checked above holds, except the ledger note's count, which non-blocking 1 corrects.
- **ADR 0016's dated note** is still accurate. It names the page and the tile, and the name lookups are unchanged.

### Findings (round 2)

#### Blocking
None.

#### Non-blocking
1. **`ledger/2026-11-05-suite-probe-reaches-private-container.md:41`: "once" should be "twice".** The note says round 1's gate "made the digest's read-only probe of `localhost:7778` once". But `ledger-row-ids` runs the digest once per merge order (`test/ledger-row-ids.test.js:102-111`), and it passed 6/0 in round 1, so both ran. Asked change: say "twice, once per merge order". If wanted, also say that port 7778 here is the agent-memory `tapestry` container's published port.

#### Harness friction
1. **The dead-endpoint recipe leaves Neo4j at the driver's default.** `src/lib/neo4j-driver.js:33` falls back to `bolt://localhost:7687`. `getConfigFromFile` reads only `BRAINSTORM_CONF_PATH` or `/etc/brainstorm.conf` (`src/utils/config.js:19`), so no env variable moves it. On this Mac the agent-memory `tapestry` container publishes 7687.
   - **Nothing reached it in either gate.** Every suite here that names the driver stubs it: `memberships-shared`, `element-schemas`, `status`, `cache-counts`, `migrate-job` K6 and `tapestry-key-paths`. `tagging-edges-wiring` swaps in a fake factory. `operations.test.js` gives its children a conf with Neo4j and Redis at port 9 (`:161-173`). Neither gate's output shows a Neo4j error.
   - **But nothing stops it either.** The suites under `test/operations/` run in-process, with the gate's own env (`operations.test.js:1164`, `:1172`). So one new suite that used the real driver would open a connection to the owner's database.
   - **Fix shape:** the recipe sets `BRAINSTORM_CONF_PATH` to a conf with Neo4j and Redis at port 9, as story 43's reviewer did. It's the same class as `ledger/2026-11-05-suite-probe-reaches-private-container.md`, so a dated note there fits.
2. **Grepping a suite's own file for network words isn't a stack-free check.** That was round 1's miss, described above. It is the same row's class, and this round used that row's stub-`PATH` fix shape, so no new row is needed.

### Verdict (round 2)
**PASS**
