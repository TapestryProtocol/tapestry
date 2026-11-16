# Review: Story 9 — `graph resolve`, the nodes a name, slug, nostr address or tapestryKey names, from a point of view

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff 5466749a...78b34637`. These are the branch's four commits after its story and ADR merged into staging as #88:
- `171a093f`, the failing tests;
- `a3d689a0`, the implementation;
- `d3f6d95f`, the live check recorded;
- `78b34637`, which renumbers the fake's test F21 to F24, after A10.13's F21–F23.

They are open against staging as PR #92.

## Quality gates (run by reviewer, not trusted)

- [x] **The full gate:** PR #92's CI check `stack-free` passed in 7m25s (run 43879807991), with the PR's head at `78b34637`. No full `npm test` ran on this Mac, by the owner's rule: the local stack is his agent-memory instance. So there is no local `npm run gate:status` line for this diff.
- [x] **Run by the Reviewer** on `78b34637`, one at a time, with every endpoint dead. All 31 stack-free suites under `test/operations/` pass: its own six, the 20 under `graph/` and the 5 under `rules/`. These are the ones the diff adds or touches, or that build on what it touches:

  | Suite | Result |
  |---|---|
  | `test/operations/graph/resolve.test.js` | 22 / 22 |
  | `test/operations/resolve.test.js` | 11 / 11 |
  | `test/operations/graph/resolve-agent-through-cli.test.js` | 2 / 2 |
  | `test/operations/graph/concept-names.test.js` | 5 / 5 |
  | `test/operations/graph-fake.test.js` | 22 / 22 |
  | `test/operations/reads.test.js` | 16 / 16 |
  | `test/operations/graph/list-elements.test.js` | 30 / 30 |
  | `test/operations/graph/list-elements-agent-through-cli.test.js` | 2 / 2 |
  | `test/operations/graph/create-concept.test.js` | 23 / 23 |
  | `test/operations/graph/update-concept.test.js` | 11 / 11 |

- [x] **The trial merge with A10.13's branch.** This was run when the PR opened, on a scratch copy of `git merge-tree`'s result for `78b34637` and `49501c49`.
  - Its two conflicts were resolved by keeping both sides, story 13's first.
  - All 33 stack-free suites pass, among them the fake at 25 / 25, `reads.test.js` at 21 / 21, and list-relationships at 26 / 26 with its agent suite at 2 / 2.
- [x] **harness-lint:** clean.
- [x] _Playwright not applicable: no UI._
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

**The independent check.** A read-only reviewer agent audited the diff. It was given the story, the ADR, the test plan, the code and the live check's result files, but not this review's conclusions.
- **Suites:** it ran all 31; every one ended "0 failed".
- **Code:** it found no defect, and checked the /docs entry by rendering it from the declaration.
- **The record:** it would block on one claim, and couldn't confirm five others from the result files.

Each of its findings was checked against the sources here, and what holds is below. Where it couldn't confirm a claim, this review checked the Implementation session's own tool results (Harness friction 2).

## Spec adherence

- [x] **Every acceptance criterion has a passing test** (the test plan's coverage map):

  | Criterion | Tests |
  |---|---|
  | AC1 | RV1–RV8, RS5 |
  | AC2 | RV9, RV10, RS4 |
  | AC3 | RV11–RV14 |
  | AC4 | RV15, RV16 |
  | AC5 | RV17, RS6, CN5 |
  | AC6 | RV18–RV21, RX1, RX2 |
  | AC7 | RV22, RS1–RS3, RS7–RS11 |

  The live check in the story's Evidence covers AC1–AC6 on a real Neo4j 5.26, through nginx. AC7 has no live part.
- [x] **No criterion is silently dropped.** Loom's definition of done holds:
  - **Declared once:** `src/operations/catalog/graph/resolve.js`.
  - **Answers for the owner and admins:** RV18 and the live check.
  - **Its command and its `/docs` entry come from the declaration:** RV20 and RV21.
  - **Each refusal has a test:** RV14, RV16, RV17, RS6, RS9 and RS10.
  - **An agent has used it through the external CLI:** RX1, RX2 and the live check's agent.
- [x] **No behavior added that isn't in the story.** `resolveOne` (AC7) is adopted by no operation, as the story says.
- [ ] **The live check's record claims more than was shown,** for AC6's sign-in and one fact of AC2 (Blocking 1 and 2). The suites cover both criteria.

## ADR adherence

- [x] **Files.** The changed files match the Implementation notes.
  - **New:** `src/operations/resolve.js` and `src/operations/catalog/graph/resolve.js`.
  - **Changed:** `src/lib/conceptNames.js`, `docs/GRAPH_OPERATIONS_CATALOG.md`, and `src/operations/refusal.js`, which is Amendment 1's.
  - **Test helpers:** the For the Tester notes have `test/helpers/graphFake.js`'s routing change and the new seed, `test/helpers/resolveGraph.js`.
  - **The "Not changed" list is untouched:** `reads.js`, `list-elements.js` and every other declaration, `_concepts.js`, `write.js`, `index.js`, `declaration.js`, and today's routes.
- [x] **Statements.** Families K, A and N, the kind filters and statement T are as Decision 3 gives them. Every input reaches Cypher as a parameter. The only text built into a statement is:
  - fixed fragments;
  - `reads.js`'s `trust('n')` and `nodeColumns('n')`;
  - `LIMIT ${limit + 1}`, after both the input's schema and `src/operations/resolve.js:203` check the limit is a whole number from 1. So does `src/operations/catalog/graph/resolve.js:65`.
- [x] **Contract.**
  - **The answer:** `ref`, `readings`, `kind`, `pov`, `ambiguous`, `kept`, `leftOut`, `candidates` and `cursor`. Each candidate is C3's node plus `kind` and `matched`.
  - **The cursor's scope** is the readings, the kind and the point of view's name.
  - **The refusals:** `bad-ref` 400, `unknown-ref` 404 and `ambiguous-ref` 409, with `unknown-pov` and `invalid-cursor` from `reads.js`. They match Decisions 1, 4 and 5 and Amendment 1.
- [x] **No new dependency.** `nostr-tools` and `ajv` were already in `package.json`, and `nostr-tools` is required lazily, as Implementation notes asks; RS11 tests that. No firmware changed.
- [x] **Deviations.** The story logs five, all small. Each keeps the ADR's contract:
  - `resolveOne` decides by the page;
  - `unknown-ref`'s words when nothing was left out;
  - rows carry `byKey` and `byAddress`;
  - the limit is checked again;
  - `bad-ref` quotes the ref.

  One difference isn't listed: the route and the command match as values, not byte for byte (Finding 4).
- [ ] **The accepted ADR was edited in place,** by `78b34637`, a `test:` commit (Blocking 3).

## Concept-graph integrity

- [x] **Handles.** No handle or assistant pubkey is written in the code; the added source holds no 64-hex literal. The instance's own keys come from `reads.js`'s `ownKeys()`, which calls `getOwnerAssistantPubkey()` at run time (`src/operations/reads.js:125`).
- [x] **Firmware:** no concept definition changed, so no reinstall is needed.
- [x] **Orientation:** the ADR oriented through the agent-memory instance's `/api/concept-graph/summaries`, read only (ADR 0009, Context).

## Things tests can't catch

- [x] **No secrets** in committed files. No added line holds an `nsec`, a 64-hex string, or the words secret, privkey, token or password. The tests build their pubkeys as `'22'.repeat(32)` and the like.
- [x] **No leftover debug logging** or `console.log` in the added source or tests.
- [x] **No commented-out code.**
- [x] **Error paths and edge cases** are handled where it matters (Findings).
- [x] **Concurrency** is considered: the count and the page are two statements (Findings).
- [x] **Security.** The inputs are checked at the boundary:
  - by ajv: `ref` is a string of at most 1,000 characters, and `kind` one of two values;
  - `textProblem` refuses a control character, a text-direction control and an invisible character;
  - every value reaches Cypher as a parameter.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling without an ADR.

## Product-guide adherence *(when the story traces to a PRD)*

- [x] _Not applicable: the book has no PRD, and resolve has no UI._

## Findings

### Blocking

1. **`engineering-team/stories/graph-operations-first-slice/9-resolve.md:173`: the stranger's refusal, and the first pass's two failed checks.** The Evidence says AC6 passes, and that the stranger "got 403 from resolve and from the operations list". It never says that the first pass recorded two of its 54 scripted checks as FAIL:
   - **The stranger's.** The script looked for `not-allowed` or `403` in the external CLI's output, which has neither:
     - the central check's body is `{"success":false,"error":"Only the owner or an admin can do this."}`, with no `code`, and the CLI prints no status;
     - the CLI reads the operations list before any operation (`clients/cli/src/main.js:122–124`), and on the list's 403 it says the key is "neither its owner nor an admin" and exits 1 (`clients/cli/src/operations.js:32`). So it never called resolve.
   - **The kind-30000 event's,** asked from the owner's point of view. Its author is scored 0.01, so it answered `kept 0, leftOut 1`, which is right.

   Both failures came from the script's expectations, and both were rechecked:
   - **The kind-30000 event:** pass 2 asked from both points of view, and both checks passed (`live-check-2.json`).
   - **The stranger:** a call by hand through nginx with the stranger's session cookie answered `HTTP 403` with that body, while the admin's session got the answer. That call's output is in no result file, only in the Implementation session's tool output. So the independent checker couldn't confirm it; this review confirmed it there (Harness friction 2).

   **Asked change:**
   - say that the first pass recorded those two checks as FAIL, why each failed, and how each was rechecked;
   - quote the direct call's status and body;
   - say that the CLI's exit 1 comes from the operations list, and that RV18 covers resolve's own 401 and 403 in the suites.
2. **`…/9-resolve.md:147`: "and the kind-30000 event as the peer's".** No check read that candidate's author:
   - the result files record only its tapestryKey, `kind` and `matched`;
   - no tool output of the session shows its author.

   Its being left out from the owner's point of view implies the peer is its author, but the author wasn't read. **Asked change:** drop the clause, or say its author wasn't read. Live cat's author and `own` are in `live-check-2.json`, so that part can stay.
3. **`engineering-team/decisions/graph-operations-first-slice/0009-resolve-and-naming-a-node.md:466`: the accepted ADR was edited in place.** `78b34637` is a `test:` commit. It changed Amendment 1's item 7 from F21 to F24, along with the test plan and the story.
   - The change is right in substance, and no rule changed.
   - But it's the pattern ledger row `2026-10-11-implementer-edited-accepted-adr` records. When that row's pattern was seen again on 2026-11-08 (tagging-edges #7, round 2), the ask was to restore the line and append a note in an `adr:` commit.

   **Asked change:**
   - restore item 7's "gains F21 for it.";
   - in an `adr:` commit, append a dated note to Amendment 1 saying the test was renumbered F24 in `78b34637`, after story 13's F21–F23, which merge first.

   This commit adds a "seen again" note to that row.

### Non-blocking (asked in the same follow-up, since one is open anyway)

4. **Record and doc nits:**
   - **The test plan's fixtures** (`9-resolve.test-plan.md:67`) say nine concept headers. The seed has eight (`test/helpers/resolveGraph.js:89–101`), and `fish` has no slug tag.
   - **Deviations misses one difference.** The ADR's live check, step 3, asks for the route and the command to match "byte for byte". They match as values (story :167), and Deviations doesn't list it.
   - **The catalog's "What a ref names"** (`docs/GRAPH_OPERATIONS_CATALOG.md:13`) says a name names nodes "without regard to case or extra white space". A stored name is compared as stored, lowered (ADR 0009, Consequences, line 359).
   - **§1's row** (`:56`) says "the `ref` as given", but the answer gives it trimmed.

   **Asked change:** correct each.

### Non-blocking (recorded, no change asked)

5. **ADR 0009, Context 4 (line 54), says no index covers a `TapestryNode`'s `uuid`.** `bin/control-panel.js:360` makes `tapestry_node_uuid` at every boot (graph-operations-foundation ADR 0003 Amendment 1). Both the agent-memory instance and a fresh scratch stack have it.
   - An address lookup still scans, because of family A's `n.uuid = $address OR n.id = $address` (`src/operations/resolve.js:157`). It took 0.50 s at 503,507 nodes, under 2 s.
   - This commit adds ledger row `2026-11-16-adr-0009-uuid-index-misstated` (`docs`).
6. **A tab, a line break or a U+FEFF inside a ref is refused `bad-ref`** (`src/operations/resolve.js:118–122`). create-concept cleans a name before checking it (`src/operations/catalog/graph/_concepts.js:113–114`). Probed here:

   | Input | resolve | create-concept |
   |---|---|---|
   | `live\tdog` | `bad-ref`, U+0009 | `live dog` |
   | `live\ndog` | `bad-ref`, U+000A | `live dog` |
   | `live` U+FEFF `dog` | `bad-ref`, U+FEFF | `live dog` |
   | a leading U+FEFF, or a no-break space | cleaned | cleaned |

   - **Not drift:** ADR Decision 1 (line 149) trims, checks and then cleans, and the code follows it.
   - **The criteria hold only partly:** AC1's "ignoring … extra white space", and AC5's "the characters create-concept refuses in a name".
   - **No answer is wrong:** the refusal is clear and names the character.
   - **Ledger:** this commit adds row `2026-11-16-resolve-refuses-cleanable-white-space` (`cleanup`), for the owner's call.
7. **`toLower` on a name that isn't text** (`src/operations/resolve.js:149`, and statement T at `:184`). Neo4j 5's `toLower` fails on a non-string. So a single node whose `name` or `tapestryValue` isn't text would fail every lookup by name or slug with a 500, for every ref.
   - **None exists on the agent-memory instance:** a read-only count found 9,549 nodes, 450 named, and none with a tapestryValue.
   - **Only raw Cypher could make one:** both writers of `tapestryValue` store the name as text (`_eventless.js:65`, `_concepts.js:685`).
   - **Ledger:** this commit adds row `2026-11-16-resolve-tolower-non-text-name` (`bug`, latent).
8. **The invisible-character message is about making a concept.** It ends "its slug, key and labels would hold the character too" (`src/lib/conceptNames.js`, through `resolve.js:122`), but a ref has none of those. Decision 6 and CN5 pin the text; letting `textProblem` take its subject is for a later story.
9. **`quote()` leaves a text-direction control raw** (`resolve.js:98`, `:122`). A terminal that prints the refusal can then show the rest of the line reordered.
   - It's logged as Deviation 5, and create-concept's `bad-name` does the same.
   - The message also names the character's code point.
   - Escaping such controls in both is for a later story.
10. **The count and the page are two reads** (`resolve.js:229–246`). A write between them can make `kept` and `ambiguous` disagree with the page by that one write. `resolveOne` decides by the page (Deviation 1), so it never acts on the difference. That's acceptable for a read.
11. **Test gaps.** The code is right in each case:
    - **A page of one:** no test pins the whole list's `ambiguous` on a page holding one candidate (limit 1, two kept).
    - **A peer with no `NostrUser`:** the seed has none, though the ADR asks for one (line 407). The trust fragment is `reads.js`'s, unchanged and tested with list-elements.
    - **Paging across a change:** no test pages across runs with the graph changed between them (ADR line 410). RV15 pages one unchanged file.
    - **RV12's claim:** the test plan (:18) says RV12 shows "both runs only read", but the test checks only the second run's log (`test/operations/graph/resolve.test.js:384`). RV19 holds the reads-only rule for a run.
12. **`78b34637`'s message** says A10.13's "PR is up first", but A10.13 had pushed its branch and opened no PR. The commit is pushed, so its message stays as it is.

### Harness friction

1. **A scratch stack boots unmigrated,** so a live timing by tapestryKey on it measures a scan: 0.351 s, against 0.005 s with the instance's constraints.
   - `tapestry_key` comes from `lifecycle migrate`, which `scripts/scratch-stack.sh` never runs.
   - The other three constraints come from the setup task, which it doesn't run either.
   - This is ledger row `2026-11-13-scratch-stack-indexes-and-volume`, seen again; this commit adds a dated note to it.
2. **Evidence from calls made by hand lived only in the session's tool output.** Five of the record's claims are in no result file:
   - the stranger's 403 from resolve;
   - 450 events after the firmware install;
   - create-concept's `already-exists`;
   - the scratch stack's missing constraints and its `tapestry_node_uuid` index;
   - the agent-memory instance's counts.

   The independent checker couldn't confirm them. This review confirmed each one from the Implementation session's own tool results, not from its prose:
   - the `strfry scan --count` that printed 450;
   - create-concept's answer, run again;
   - `SHOW CONSTRAINTS` and `SHOW INDEXES` on `tapestry-scratch`;
   - the read-only count;
   - the cookie call.

   Whether a Reviewer may search a session's transcript is OPEN.md row 343's open question; here the Implementer and the Reviewer are one session. This commit adds ledger row `2026-11-16-live-check-hand-calls-unsaved` (`meta`).
3. **An accepted ADR was edited in place by a non-`adr:` commit** (Blocking 3). This is ledger row `2026-10-11-implementer-edited-accepted-adr`, seen again; this commit adds a note to it.

## Verdict

**CHANGES_REQUESTED**

There are three blocking issues, all in the record, and the code needs no change.
- **Blocking 1 and 2:** the live check's record claims more than was shown, and doesn't say that two scripted checks failed and were rechecked.
- **Blocking 3:** the accepted ADR was edited in place by a `test:` commit.

The asks are all text:
- the Evidence's sign-in paragraph and one clause of AC2;
- ADR 0009's item 7 restored, with a note appended in an `adr:` commit;
- the four nits of Finding 4.

The code, the tests and the ADR conformance hold, and the full gate is green. The story stays `Approved` this round.

**CHANGES_REQUESTED**

---

## Round 2 (2026-11-16, on `f929861d`)

**Diff:** `git diff 7e732506..f929861d`, all on PR #92:
- `e576a982` (`adr:`), the ADR's item 7 restored, with a note;
- `bf9b1ab1` (`test:`), the test plan's count;
- `922a548a` and `f929861d` (`impl:`), the record, the catalog and the declaration's description.

### Quality gates (run by reviewer, not trusted)

- [ ] **The full gate: still queued when this round was written.** PR #92's CI check `stack-free` on `f929861d` (run 43891584502) hadn't started at 15:02 UTC.
  - **Round 1's run** passed on `78b34637`.
  - **Round 2 changes one string of code,** the declaration's description. The 31 suites that load the declaration pass with it here, RV21 rendering it into /docs.
  - **This verdict stands on that run passing.** If it fails, the PR's check shows it, and the story goes back to `Approved`.
- [x] **Run by the Reviewer** on `f929861d`, one at a time, with every endpoint dead. All 31 stack-free suites under `test/operations/` pass:

  | Suite | Result |
  |---|---|
  | resolve | 22 / 22 |
  | `resolve.js` | 11 / 11 |
  | the agent suite | 2 / 2 |
  | the fake | 22 / 22 |
  | concept names | 5 / 5 |
  | create-concept | 23 / 23 |
  | update-concept | 11 / 11 |

- [x] **harness-lint:** clean.
- [ ] **Not re-checked live.** No scratch stack was booted for this round. The fix changes records, docs and one description string; RV21 renders that string into /docs.

### Each ask, checked from the tree

Every ask was checked from commands and the raw output, not from memory, including the wording round 1 suggested:

| Round 1 | The fix | How it was checked |
|---|---|---|
| Blocking 1 | The Evidence gains a paragraph on the three failed scripted checks (story :131–137), and AC6's sign-in is rewritten (:181–188) | **The counts:** 54 and 52 from `live-check-1.json`, 10 and 9 from `live-check-2.json`, and each FAIL's detail.<br>**The peer's score when the kind-30000 check ran:** `live-check.js`, where `setInfluence(0.01)` is at :147, before the check at :169.<br>**The CLI's path:** `clients/cli/src/main.js:122–124` and `operations.js:32`, `:41`.<br>**The call by hand:** the session's tool output. |
| Blocking 2 | AC2 names the one candidate whose author and `own` were read, live cat (:155) | `live-check-2.js:64` is the only check that reads `own`. No result file or tool output shows the kind-30000 candidate's author. |
| Blocking 3 | Item 7 is restored, with a dated note after it, in `adr:` commit `e576a982` | `git diff 171a093f f929861d` on the ADR shows only the note's added line. |
| 4 | The test plan says eight headers (`:67`); Deviations gains a line (story :215); the catalog's sentence (`:13`) and §1's row (`:56`) are corrected | `test/helpers/resolveGraph.js` makes eight `header(` calls, and `fish` has no slug. "without regard to case or extra white space" is gone from both the catalog and the declaration. |

**Found while checking, and fixed before this verdict.** `922a548a`'s new text claimed two things the raw output doesn't show:
- **That the first pass's kind-30000 check answered `kept 0` and `leftOut 1`.** It recorded only an empty list; those numbers are the second pass's.
- **That the admin's call by hand answered `live dog`'s candidates.** Its output was cut off before them; it showed a successful answer for `live dog`.

`f929861d` narrows both, and cites `operations.js:41`, where the CLI throws its message.

**Beyond the asks.** The declaration's description, which /docs shows (`src/operations/catalog/graph/resolve.js:28`), held the same sentence as the catalog and is corrected the same way. RV21 and RV22 pass with it.

**Scope.** Round 2 changed five files, all of them for the asks above and the records they name.

### Findings

**Blocking:** none.

**Non-blocking:** none new. Round 1's findings 5–12 stand as records, with their ledger rows.

### Verdict

Every ask landed and was checked from the tree, and all 31 suites pass on `f929861d`. The full gate passed on round 1's code, and its run on round 2's was queued at writing (Quality gates). The story is `Done` in this commit.

**PASS**
