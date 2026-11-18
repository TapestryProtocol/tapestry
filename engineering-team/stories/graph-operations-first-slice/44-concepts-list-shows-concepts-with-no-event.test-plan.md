# Test Plan: Story 44 — The Concepts page and the Dashboard show a concept with no event

**Story:** `engineering-team/stories/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.md`
**ADR:** none. Architecture was skipped, as for a bug with an obvious fix (David, 2026-11-18).
**Date:** 2026-11-18

## The one interface this plan fixes

Each row of the page's query says whether its header came from an event, as `hasEvent`. It is true for a header labelled `NostrEvent`, and false for one with no event. With no ADR, the plan names the field, so the tests can build the rows the page builds. The Disposition cell, Save & next and the state filter all turn on it.

## Coverage map

Every test is in `test/concepts-list-shows-concepts-with-no-event.test.js`, registered in `test/registry.js`.

| Criterion | Test | Level |
|---|---|---|
| AC1 | S1: the page's header scan admits a header with no event, and every header it admitted before | source |
| AC1 | L1: the page's own query lists a concept `graph create-concept` made, with `hasEvent` false, beside the firmware's concepts. Since round 2 the concept has one element, and L1 checks its element and set counts too | live, scratch only |
| AC1, AC4 | L4: the page lists exactly every header it listed before plus every header with no event, and `hasEvent` says which | live, scratch only |
| AC2 | S3: the tile's count admits a concept with no event, and every concept it counted before | source |
| AC2 | L2: the tile's own query counts the concept with no event | live, scratch only |
| AC3 | U1: a row of this instance's own concept with no event isn't under Undispositioned (mine); the same row from an event is | unit |
| AC3 | U2: a row with no event is under Not yet shared (mine) and All states | unit, sentinel |
| AC3 | S2: each row of the page's query says `hasEvent` | source |
| AC3 | S4: Save & next's set reads the row's event fact | source |
| AC3 | S5: the Disposition cell of a row with no event says "no event yet", in place of Disposition… | source |
| AC4 | U3: every other row is judged as before | unit, sentinel |
| AC4 | L3: a header from an event without the shared label keeps its row and its count | live, sentinel |
| AC4 | S6: the guard's kept-list no longer excuses this story's two lines with "a header is always an event" | source |
| ADR shared-concepts-seeding/0002 | S7 (round 2): Shared by me's waiting count scans exactly the headers the Not yet shared list it links to does | source |
| ADR shared-concepts-seeding/0002, AC3 | L5 (round 2): Shared by me's waiting count equals the Not yet shared list, the concept with no event in both | live, scratch only |
| AC4 | The neighbouring suites stay green: `not-yet-shared-filter`, `list-headers-disposition-column`, and `tapestry-key-paths` (G11 and G18) | regression |

A sentinel passes before the fix and must still pass after it.

## How the levels split

- **U, stack-free, gating in CI.** These run against `ui/src/utils/conceptStateFilter.js`, loaded by dynamic import as `not-yet-shared-filter` loads it, over hand-built rows. Each test that checks something doesn't happen first shows that the path ran: U1's control is the same row with an event.
- **S, stack-free, gating in CI.** These read the source.
  - S1 and S3 read the label expression of each query's first `MATCH` and judge which of four kinds of header it admits. So they test what the query matches, not how it's written:
    - `:NostrEvent|TapestryNode`, `:ListHeader|ConceptHeader` or no label at all pass;
    - `:NostrEvent` alone fails, since it skips a header with no event;
    - `:TapestryNode` alone fails too, since it skips a header from an event where `tapestry-keys` hasn't run.
  - S4 and S5 are token checks at the page, the layer the defect lives in (OPEN.md row 169). They're the weakest tests here, and V1 backs them.
- **L, scratch only.** These run the page's own Cypher and the tile's own Cypher, read from source, on a real Neo4j. Since round 2, L5 runs Shared by me's own population query too. Leave `TAPESTRY_CONTAINER_PORT` unset for them: the helper reads it as the control panel's port inside the container, so a dead value there turns every L test into a skip (ledger row `2026-11-18-container-port-skips-scratch-checks`). The live suite reaches the scratch stack through `test/helpers/scratchLoopback.js`, which refuses any container not named `tapestry-scratch…`. So the L tests never touch the owner's stack, and they skip in CI, which has no stack.
  - L1, L2 and L4 make "eventless lantern" with `graph create-concept` over loopback. A local caller passes the operations' gate.
  - L3 takes the shared label off the concept-header header, as on an instance that hasn't run `tapestry-keys`, and puts it back afterwards.
- **No browser test.** This checkout has no `ui/node_modules`, and CI runs no Playwright. V1 checks the rendered row.

## V1: the rendered page, after the staging merge (read-only)

Once the merge reaches david.tapestry.ninja's image, open `/tapestry/concepts` there:
- concept graph rule has a row (AC1), and its disposition cell says it has no event yet (AC3);
- Undispositioned (mine) leaves it out, and Not yet shared (mine) lists it (AC3);
- the Dashboard's Concepts tile reads 48, if nothing else there has changed (AC2).

## Edge cases

- [x] **An instance that hasn't run `tapestry-keys`,** whose headers from events lack the shared label: S1 and S3's label sets, and L3 live.
- [x] **A plain list header from an event,** not a concept: S1's label sets include one, and L4 counts every one.
- [x] **A repeat run on the same scratch stack:** the fixture accepts `already-exists`.
- [x] **A row that doesn't say whether it has an event,** from another caller of the filter: U3 judges it as before.
- [x] **Concept Graph API unavailable:** U and S need no stack, and L skips, giving its reason.
- **Another author's concept with no event can't exist on an instance:** `graph create-concept` makes its nodes as the assistant (ADR graph-operations-first-slice/0016, Decision 1). Not tested.

## Left for a ledger row

Nine more lines in `test/operations/lifecycle/nostr-event-lookups-kept.json` rest on "a header is always an event", which story 16 made false:
- `src/api/adoption/index.js`;
- `src/api/normalize/index.js`, two lines;
- `src/api/property/index.js`;
- `ui/src/pages/reading/readVerbs.js`;
- `ui/src/pages/reading/writeVerbs.js`, three lines;
- `ui/src/pages/shared-concepts/SharedByMe.jsx`.

Some are right to keep, on another ground: the signing routes must not find a concept with no event (story 16), and Shared by me lists only published concepts. Others are old tools that D15 leaves as they are. Each needs its reason restated or its line fixed. That's a ledger row, not this story; the Implementer or the Reviewer files it.

*(2026-11-18, review round 1, blocking 1: Shared by me's line isn't a list of published concepts. That list comes from `/api/shared-by-me`. The line is the population of Shared by me's waiting count, which ADR shared-concepts-seeding/0002 holds to this page's Not yet shared list. Round 2 widens it to this page's scan, on David's choice, so eight lines are left, and the ledger row lists eight.)*

## Test infrastructure

- **Framework:** the Node runner, `node test/test.js` through `test/registry.js`. A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- **Concept Graph API:** U and S need none. L needs a scratch stack, from `scripts/scratch-stack.sh up`, which mounts this checkout's `src/` and installs the firmware.
- **Firmware state:** installed (the scratch script does it).
- **Fixtures:** none on disk. L makes its concept on the scratch stack.
- **Never this Mac's own stack.** Its `tapestry` container is the owner's agent-memory instance. Run U and S with `TAPESTRY_CONTAINER=no-such-container` and dead endpoints.

## How to run

Stack-free, as CI runs it:

```
TAPESTRY_CONTAINER=no-such-container node test/concepts-list-shows-concepts-with-no-event.test.js
```

With the live checks:

```
bash scripts/scratch-stack.sh up
TAPESTRY_CONTAINER=tapestry-scratch node test/concepts-list-shows-concepts-with-no-event.test.js
bash scripts/scratch-stack.sh down
```

The neighbouring suites, with every endpoint dead:

```
BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_PORT=9 TAPESTRY_CONTAINER=no-such-container node test/not-yet-shared-filter.test.js
```

The same goes for `test/list-headers-disposition-column.test.js` and `test/operations/lifecycle/tapestry-key-paths.test.js`.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-18, on staging `3b7ae010` with the story at `be5f2301`.

Stack-free, with `TAPESTRY_CONTAINER=no-such-container`:

```
  FAIL  U1 (AC3): a row of this instance's own concept with no event is not under Undispositioned (mine); the same row from an event is
  PASS  U2 (AC3): a row with no event is under Not yet shared (mine) and All states
  PASS  U3 (AC4): every other row is judged as before: from an event, or not saying, or another author's, or already dispositioned
  FAIL  S1 (AC1, AC4): the Concepts page's header scan admits a header with no event, and every header it admitted before
        the page's header scan, MATCH (h:NostrEvent), skips a concept header graph create-concept made, with no event (ListHeader, ConceptHeader, TapestryNode). …
  FAIL  S2 (AC3): each row of the page's query says whether its header came from an event, as hasEvent
  FAIL  S3 (AC2, AC4): the Dashboard's Concepts tile counts a concept with no event, and every concept it counted before
        the Concepts tile's count, MATCH (n:NostrEvent:ListHeader)-[:IS_THE_CONCEPT_FOR]->(), skips a concept header graph create-concept made, with no event. …
  FAIL  S4 (AC3): Save & next passes over a row with no event: the page's undispositioned set reads the row's event fact
  FAIL  S5 (AC3): the Disposition cell of a row with no event says the concept has no event yet, in place of Disposition…
  FAIL  S6 (records): the guard no longer keeps the Concepts page's scan or the Dashboard's concept count on "a header is always an event"
  SKIP  L1 … L4  (TAPESTRY_CONTAINER is 'no-such-container', not a scratch container …)
concepts-list-shows-concepts-with-no-event: 2 passed, 7 failed, 4 skipped
```

On a scratch stack (`tapestry-scratch`, firmware installed, this checkout's `src/`):

```
  FAIL  L1 (AC1): … the page's query, run on the scratch graph, lists 45 headers, and not 39998:b64e8dd2…:eventless-lantern, the concept graph create-concept made there (AC1).
  FAIL  L2 (AC2): … the Concepts tile counts 39; the graph holds 40 concepts, 1 of them with no event (AC2).
  PASS  L3 (AC4): on a scratch stack, a header from an event without the shared label, as where tapestry-keys hasn't run, keeps its row and its count
  FAIL  L4 (AC1, AC4): … the page should list the 45 headers from an event and the 1 with none. Missing 1: ["39998:b64e8dd2…:eventless-lantern"]; not headers 0: [].
concepts-list-shows-concepts-with-no-event: 3 passed, 10 failed, 0 skipped
```

Each failure names the missing behavior: no row, no count, no `hasEvent`, no "no event yet", and the false reason in the kept-list. None is an import error or a typo.

The neighbouring suites are green before the fix, with every endpoint dead:
- `not-yet-shared-filter`: 15 passed, 0 failed, 2 skipped;
- `list-headers-disposition-column`: 12 passed, 0 failed;
- `tapestry-key-paths`: 20 passed, 0 failed, G11 and G18 among them.

### Round 2: review round 1's cases

Written before round 2's fix, and confirmed failing on 2026-11-18 on top of `4a92ecae`. On a scratch stack:

```
  FAIL  S7 (ADR shared-concepts-seeding/0002): Shared by me's waiting count scans exactly the headers the Not yet shared list it links to does
        Shared by me's waiting count scans MATCH (h:NostrEvent), and the list it links to, the Concepts page's Not yet shared (mine), scans MATCH (h:NostrEvent|TapestryNode). They disagree on a concept header graph create-concept made, with no event. …
  FAIL  L5 (ADR shared-concepts-seeding/0002, AC3): on a scratch stack, Shared by me's waiting count equals the Not yet shared list it links to, the concept with no event in both
        Shared by me's population, run on the scratch graph, holds 45 headers and not 39998:b64e8dd2…:eventless-lantern, the concept with no event the list holds.
concepts-list-shows-concepts-with-no-event: 13 passed, 2 failed, 0 skipped
```

Stack-free, the suite gives 9 passed, 1 failed (S7) and 5 skipped. L1's new element and set counts pass, since the page already counted the element.

## Deviation

The workflow puts a book's failing tests on `feat/<book-slug>`. This book's stories each take a branch of their own, named for their Loom task, and this one has no Loom task, so its branch is `fix/concepts-list-eventless-concepts`, off staging `3b7ae010`.
