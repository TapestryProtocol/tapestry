# Review: Story 28 — `graph link-set` and `unlink-set`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-15
**Diff:** `git diff origin/staging...HEAD`: merge base `8461d12a`, HEAD `41fdf5a7`. It holds seven commits and 21 files, +3124 −4. `origin/staging` has since moved on to `33c5ce2f`.
**Against:**
- the story, [28-link-set-and-unlink-set.md](../../stories/graph-operations-first-slice/28-link-set-and-unlink-set.md);
- [ADR 0028](../../decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md), with Amendments 1 and 2;
- the [test plan](../../stories/graph-operations-first-slice/28-link-set-and-unlink-set.test-plan.md), with its live-check record.

**Verdict:** CHANGES_REQUESTED, on one blocking finding.

## Quality gates (run by reviewer, not trusted)

These follow this Mac's rules: no `npm test`, no `:7778` and no docker. Every run had dead endpoints exported: `NEO4J_URI=bolt://127.0.0.1:9`, Redis on port 9, and both base URLs at `127.0.0.1:9`.

- [ ] **`npm test`** was not run: on this Mac it writes to the private agent-memory instance.
  - `node test/gate-status.js -- --list` answers `no gate run records in /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/A10.28/tmp/gate-runs`. So there is no run id or verdict to quote.
  - The full gate comes from the pull request's CI.
- [x] **The five new suites,** each run on its own with `node -e "require(…).run()…"`: 57 of 57.
  - link-set 19/19 and unlink-set 18/18;
  - sets-agent-through-cli 1/1;
  - class-thread-acyclic 9/9 and set-has-a-parent 10/10.
- [x] **`node test/operations.test.js`,** run with a temporary `node_modules` link that was made and removed in the same command.
  - It printed `operations: 394 passed, 0 failed, 0 skipped`, exited 0, and took 55 s. W1 (both of them), X1 and X2 pass.
  - Afterwards the link is gone and `git status` is clean.
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)`, run again once the link was gone.
- [x] **Merges,** with `git merge-tree`:
  - into `origin/staging` (`33c5ce2f`) the merge is clean;
  - with story 16's branch (`origin/A10.16-create-update-concept`, `410a6ed2`) it has one textual conflict, in `docs/GRAPH_RULES.md`. This story's 57 tests pass over that merged tree, in a scratch copy.
- [ ] `npm run test:playwright` doesn't apply: there is no UI change.
- [ ] _Lint not configured — skipped._ _Typecheck not configured — skipped._ _Build not configured — skipped._

### Two checks beyond the gate

Both ran in scratch copies outside the repository. Nothing from them is committed.

**Breaking the real code.** The test plan's break-one-thing table was run against a throwaway reference, not this implementation. So ten breaks were applied to this code, one at a time, each against the suites that should catch it:

| Broken | Failed |
|---|---|
| the lock leaves its property (`_sets.js:241` taken out) | UL18 |
| the prune check runs with no `before` (`link-set.js:84`) | LS11 |
| supersets lose their `superset-of:` descriptors (`_sets.js:360`) | LS12, LS13, UL11, UL12 |
| a superset isn't exempt from `last-parent` (`set-has-a-parent.js:36`) | UL9, UL11, UL12, SP5, SP8, SP9 |
| no peer check (`unlink-set.js:81`) | UL14 |
| the prune covers every firmware concept, manifest.json or not (`_sets.js:307`) | LS14 |
| "own" leaves out the owner (`_sets.js:415`) | UL6 |
| link-set's re-check after the `MERGE` taken out (`link-set.js:83`) | nothing |
| unlink-set's re-check after the `DELETE` taken out (`unlink-set.js:97`) | nothing |
| unlink-set takes no lock (`unlink-set.js:74`) | nothing |

The last three are what the test plan expects. Only a second writer can make the re-checks or the lock matter, so only the live check's step 8 shows them (non-blocking 1).

**A trust-pipeline card set.** The probe added one node to a small seeded graph and called the operations through the suites' own harness, against the unmodified catalog.
- **The node** is shaped as `src/cns/addSetsOfMetricsCards.sh:26–30` makes one: `(:Set:SetOfNostrUserWotMetricsCards:TapestryNode {tapestryKey, observee_pubkey})`, with no `uuid` and no name.
- **The results** are under Blocking 1.

## Spec adherence

| AC | Evidence | Result |
|---|---|---|
| AC1, link a set | LS1–LS3, LS15, LS16; live steps 3, 4 and 9 | Met |
| AC2, safe to repeat | LS4 and X3. Two calls at once: live step 8 gave one `linked`, one `already-linked` and one entry | Met |
| AC3, what link-set refuses | LS5–LS10, CA1–CA8 | **Not met for one kind of node.** A trust-pipeline card set is accepted as `set` and as `parent` (Blocking 1). |
| AC4, unlink a set | UL1–UL7, UL13, UL15, UL16 | Met |
| AC5, what unlink-set refuses | UL8–UL10, UL18, SP1–SP9; live steps 4 and 8 | **Not met for one kind of node.** A card set counts as a parent (Blocking 1). The race path's wording is non-blocking 6. |
| AC6, the links left alone | UL11–UL14, LS11–LS14; live step 5 | Met, in the order Amendment 1 item 3 ratifies (non-blocking 2) |
| AC7, two rules defined once | CA1–CA9, SP1–SP10; docs/GRAPH_RULES.md §5–6 | Met as written. Blocking 1 undermines its check mode. |
| AC8, it lasts and reaches agents | See the list below | Met, except that a restore onto a fresh instance wasn't observed (non-blocking 3) |

AC8's evidence:
- **A reinstall:** live step 6.
- **A restore:** live step 7, onto the same instance.
- **Access:** 401 and 403 in LS17 and UL16.
- **The list and `/docs`:** LS19 and UL17.
- **The command,** recorded as `local`: LS18, UL16 and live step 3.
- **The agent:** X3 and live step 4. There was no change to the CLI: the diff doesn't touch `clients/`.

- [ ] **Every acceptance criterion has a passing test.** Each does, as written. But AC3's refusal of "any other node", and what AC5 is for, both fail for card sets, and no test seeds one.
- [x] **No criterion is silently dropped.** Two narrowings are both on record: AC6's order (Amendment 1 item 3) and the optional fresh-instance restore (test plan line 140).
- [x] **No behavior added that isn't in the story or the ADR.** The lock is Amendment 2's, which the owner approved (commit `cdf71856`).

## ADR adherence

**The two operations** (Decision 1). Inputs, guards, `repeatKey`, refusals, results and the steps of `apply` match: `link-set.js:63–90` and `unlink-set.js:67–102`.

**The helper** (Decision 2). Every function in the table is in `_sets.js`. The story's Deviations list the extras: `requireEnds`, `isLinked`, `say`, the shapes, `ancestors`' `nodes` map and `firmwarePrunes`' `isNew`. Only the small `isAbove` isn't listed.

**The rules** (Decisions 3 and 4) match, including the twelve-node cut of the chain and both wordings of `last-parent`.

**What counts as which** (Decision 5) is built exactly as written. The definition itself is Blocking 1.

**Firmware's links** (Decision 6) match install:
- `categoryToSlug` at `install.js:123`;
- part (a), create-set with `dTag` as `word.slug` or the file's name, at `:380` and `:400`;
- part (b) at `:480`, and part (c) at `:573`;
- part (d): the `headerATag` parse at `:1016–1022`, `supersetFrom` at `:1139`, the `MERGE` at `:1297`;
- the prune at `:807–833`.

The four parts are the only class-thread links an install makes:
- `install.js` writes the propagation link only through those parts;
- of the routes install calls, only create-set writes one. `src/api/normalize/index.js` writes it in just two places: link-concepts (`:4046`) and create-set (`:4357`).

**Peers' links and own letters** (Decision 7) match. R5 reads the tag nodes the import makes (`src/api/neo4j/eventSync.js:243–260`). An event's `id` is what makes a letter: add-subset tests `s.id IS NOT NULL` as having an event, and the import sets `e.id`.

**The walks** (Decision 8) match.

**Two writes at once** (Decision 9):
- link-set's `MERGE` serializes them (live step 8).
- unlink-set's `DELETE` doesn't, which is what Amendment 2 found.
- The four-node cycle race is documented as the residual. The same shape for the prune isn't (non-blocking 5).

**The statements** (Decision 10). R1–R5, W1, W2 and the lock statement are as listed, and the only names interpolated are firmware's relationship aliases. The real driver's `toJS` gives `RETURN n` as `{ ...properties, _labels, _id }` (`src/lib/neo4j-driver.js:162–163`), which is the shape `nodeOf` reads.

**Docs and agents** (Decision 11):
- GRAPH_RULES.md §5–6 are in the six-part format, and the catalog's two rows are updated;
- the list, `/docs` and the command come from the declarations;
- the external CLI is unchanged.

**Amendment 1:**
- **Item 1,** the 29 concepts: `firmwareLinks` reads from the files which concepts have a manifest.json, and LS14 holds it (the break of `_sets.js:307`).
- **Item 2:** `UNKNOWN_SET_OR_PARENT` is at `_sets.js:49`.
- **Item 3:** see non-blocking 2.
- **Item 4:** the re-checks show only in the live check, as said (the last three breaks above).
- **Item 5:** recorded as ledger row `2026-11-16-curator-instance-superset-self-loop`.

**Amendment 2:**
- **The lock** is at `_sets.js:228–242`. It uses the statement shape the fakes already run (S8) and ADR 0016's property name.
- **No collision with ADR 0016's lock.** That one is taken on the concept-header concept's header, which can never be an unlink-set `set`.
- **One deviation:** the lock comes after `requireEnds`' reads, not "before it reads anything" (non-blocking 4).

**Files the ADR said not to edit** are untouched: `write.js`, `_nodes.js`, `graphOpsSuite.js`, `relationship-type-allowed.js`, `src/api/**`, the fakes and `changes.js`. There is no new dependency: `package.json` is untouched.

**Deviations, flagged:**
1. Amendment 2's placement of the lock (non-blocking 4).
2. AC6's order (Amendment 1 item 3; non-blocking 2).
3. The live-check record is in the test plan, not the story.
   - ADR line 348 and test plan line 69 both say "the story", "as story 5's did".
   - Story 5's record is in its test plan too (`5-field-mapping.test-plan.md:253`), so no change is asked.
4. The story's eight Deviations: each was checked against the code and accepted.

## Concept-graph integrity
- [x] **Handles are in `kind:pubkey:slug` form,** built at call time with `getOwnerAssistantPubkey()` (`_sets.js:277–287`). A scan of the 11 new files for 64-hex literals finds none.
- [x] **No concept definition changes,** so no firmware reinstall is needed (the ADR says the same).
- [x] **The work oriented through `/api/concept-graph/summaries`** (ADR Context 11). Live step 1 checked the four handles and the class thread's shape again.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging, `console.log` or TODO in the five new source files.
- [x] No commented-out code.
- [ ] **Error paths and edge cases handled where it matters:** see Blocking 1, and non-blocking 6 and 8.
- [ ] **Concurrency and race conditions considered.** They were, thoroughly: Decision 9, Amendment 2 and live step 8. Two gaps remain:
  - no automated test holds the guarantees (non-blocking 1);
  - the prune's residual race isn't documented (non-blocking 5).
- [x] **Security:**
  - every value is a parameter, and both inputs must match the tapestryKey pattern (`_nodes.js:11`, `:15`);
  - the only names interpolated are firmware's relationship aliases (`_sets.js:114`, `:121`, `:131`, `:154`; `link-set.js:75`; `unlink-set.js:86`);
  - access is `owner-and-admins` (LS17, UL16);
  - nothing signs, publishes or reads a key. The spy (LS16, UL16) and a scan of the source agree, and the relay stayed at its 466-event baseline through the live check.

## Architecture invariants
- **POV-first.** Nothing global is computed or stored. A peer's link is refused as theirs, and whether it counts is left to read time (`unlink-set.js:80–83`).
- **Permissionless publishing.** Nothing gates a publication. The peer-link refusal declines to edit a peer's recorded claim (D4); it rejects no event.
- **Filter at read time.** No result is stored per point of view, and `letters` is derived on each call.
- **Local-first** (BIBLE §30). Nothing discards local state, and the owner's links last:
  - through a reinstall, because link-set refuses the links its prune would take out (LS12–LS14, live step 6);
  - through a restore (live step 7).
- **The TA pubkey** is resolved at runtime everywhere (`_sets.js:277–278`, `:413–415`).

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling without an ADR.

## Product-guide adherence
Not applicable: the book has no PRD.

## Docs
- **The rules document:** GRAPH_RULES.md §5–6 match the code, except one wording slip (non-blocking 7).
- **The catalog:** its two rows list the refusals the declarations make.
- **The four new ledger rows** are well formed (lint L15 is clean), and their citations check out: `install.js:781–805`, `:807–833`, `:1139` and `:1297`; `nodes.js:72`; `routeWalk.js:78`; `.gitignore:41`.
- **The test plan's live-check record** agrees with the code and the commits. Its claim about the image holds: `git diff 09dc9b7b HEAD -- firmware bin clients` is empty.

## Findings

### Blocking

1. **`src/operations/catalog/graph/_sets.js:104–109` (`kindOf`), as ADR 0028 Decision 5 (line 199) and Context 4 (line 33) define it.** The trust pipeline's card sets count as sets.

   **The rule.** Decision 5 makes every node labelled `Set` and not `Superset` a set.

   **The fact it misses.** The trust pipeline labels its card sets `Set` too: `(:Set:SetOfNostrUserWotMetricsCards)`.
   - **What they are:** each has a tapestryKey, no address and no class-thread edges (`src/cns/addSetsOfMetricsCards.sh:26–30`, `src/cns/prepareNeo4jForCustomerData.sh:100`).
   - **What the ledger says.** Ledger row `2026-11-15-card-sets-carry-the-set-label`, on staging since PR #70, counts them:
     - 370,377 of staging's 370,401 `Set` nodes, and 390,460 of production's 390,480;
     - it says they "aren't sets of the concept graph";
     - and that the question "is worth deciding before more readers of `:Set` are written".
   - **This diff adds two operations and two rules that read `:Set`.**

   **The probe**, against the unmodified catalog:
   1. A link-set of a card set as `set`, under Pets, answers `200 linked`. AC3 refuses "any other node".
   2. An unlink-set of that card set from Pets answers `409 last-parent`. So a link made by mistake can't be undone through the new operations.
   3. A link-set of Indoor pets under a card set, as `parent`, answers `200 linked`.
   4. An unlink-set of Indoor pets from Pets, its only concept-graph parent, answers `200 unlinked`. The card set counts as a parent (`set-has-a-parent.js:40`).
      - Afterwards pet's class thread no longer reaches Goldie, and Indoor pets' only parent is the card set.
      - That is the state `last-parent` exists to refuse: "no class thread would reach it or its elements" (AC5).

   **The check mode.** Run over "the graph's sets" (GRAPH_RULES.md:82), `set-has-a-parent` would name every card set `last-parent`. That is about 370,000 findings on staging, and none of them is something wrong. The ADR chose Option A for the opposite reason: "every finding is something wrong" (line 73).

   **Asked change, in three steps.**
   - **The Architect:** ADR 0028 Amendment 3, with the owner's approval, refining Decision 5 so that a trust-pipeline card set is neither a set nor a parent. Two candidates:
     - require an address (`uuid`), as story graph-operations-foundation #8 did for Pass 3. Every concept-graph set has one: create-set's, add-subset's, the pull's, and story 16's `_eventless.js` nodes. A card set has none, and R1 and R3 already return `uuid`;
     - or leave out the label `SetOfNostrUserWotMetricsCards` by name.

     The amendment also says what the check mode runs over, and corrects Context 4.
   - **The Tester:** a card-set fixture, with tests that fail first:
     - link-set refuses it as `set` (`not-a-set`, `input: set`) and as `parent` (`not-a-parent`);
     - unlink-set refuses it the same way;
     - taking a set out from under its one real parent is refused `last-parent`, even when a card set is above it too;
     - neither rule has a finding for a card set.
   - **The Implementer:**
     - `kindOf`, as the amendment says;
     - the words "a node labelled Set" in the refusals at `_sets.js:76` and `:81`;
     - GRAPH_RULES.md §6's **Check** line, and §5's if the amendment touches it;
     - a line on the ledger row that names these readers. The row is on staging, so merge staging into the branch first.

### Non-blocking

1. **No automated test holds the concurrency guarantees.** These are `link-set.js:81–83`, and `unlink-set.js:74` and `:95–97`.
   - Taking out either re-check, or the lock, leaves every stack-free suite green (the last three breaks above). The live check's step 8 is the only evidence.
   - The race is real: without the lock, 3 of 8 rounds left a set under no parent.
   - **Optional:** a stack-free test over a transaction that records its statements, pinning the order: the lock before the `isLinked` read, and the re-check after the `MERGE` or `DELETE`. Or a ledger row, so a later refactor can't drop them unnoticed.
2. **AC6's order (Amendment 1 item 3).** A firmware or peer link that is also the set's last parent is refused `last-parent`, not `firmware-link` or `peer-link`.
   - **How common it is.** The test plan says that after an install this holds for most links of parts (a) and (c) (line 284).
   - **How it misleads.** The advice to link the set under another parent first leads to a second refusal, `firmware-link`. And "delete it once it is empty" is offered for a peer's set.
   - **Ask the owner to confirm it.** Amendment 2 records the owner's approval and Amendment 1 doesn't, while the test plan put this question to "Owner's or Architect's call".
3. **The restore onto a fresh instance (AC8) wasn't observed.** The plan made it optional (line 92), and line 140 records it as not run. The record shows a restore onto the same instance.
   - The fresh case rests on inference: these operations write only to Neo4j, and story 16's live check restored onto a fresh instance the same day.
   - Run it if the owner wants it before merge.
4. **Amendment 2's wording.** It says the lock comes "before it reads anything", but `unlink-set.js:70–74` takes it after `requireEnds`' reads, and the guard always reads before `apply`.
   - The behavior is equivalent: every read the race depends on comes after the lock.
   - It isn't in the story's Deviations. **Optional:** list it there, or reword the amendment.
5. **The prune check has the same residual race as Decision 9's four-node cycle,** and it isn't documented.
   - **The example.** Take F, a firmware concept's superset, with Y a set directly under it, and an owner's set A already above an owner's set B. Two link-sets at once, `S → A` (with S one of F’s sets) and `B → Y`, share no node. Together they make the earlier direct link `F → Y` prunable, so a reinstall takes out a link link-set made.
   - **The effect.** Membership is unchanged.
   - **Optional:** Decision 9 and the Consequences name only the cycle. A sentence there, or a ledger row.
6. **`unlink-set.js:95–97`.** On the race path, the re-check after the `DELETE` finds `last-parent` and uses the check's wording: it names the set, not the parent being left. AC5 says "The refusal names that parent".
   - The story's Deviations note the wording.
   - **Optional:** name the parent on that path.
7. **`docs/GRAPH_RULES.md:73`:** "Today's `POST /api/normalize/add-relationship` checks for no cycle, so it can make one" reads as its opposite. §6 says it plainly at line 82: "doesn't check". **Suggest:** "doesn't check for a cycle".
8. **`_sets.js:298–305` and `:327–333`, latent.**
   - **What it assumes.** Part (c) addresses an element file as `39999:<TA>:<word.slug>`. But create-element gives elements the d-tag `slug(name)-hash8(header)` (`src/api/normalize/index.js:1875`).
   - **Why nothing breaks today.** All ten shipped part-(c) edges run from a set to a set. `test/helpers/classThreadSeed.js`'s `addFirmware` makes the same assumption.
   - **Optional:** a comment, or resolve elements as install does.
9. **`test/operations/graph/unlink-set.test.js:421`.** UL18's refused case is refused by the guard before `apply` runs, so it never takes the lock. Only UL1's unlink exercises it.
   - The first break above shows UL18 still catches a lock that leaves its property, so this is about precision only.
10. **Merging beside story 16.** Both branches append to `docs/GRAPH_RULES.md` after §3, so whichever merges second resolves one conflict.
    - Keep §4, `concept-slug-unique`, then §5–6. Nothing needs renumbering.
    - This story's tests pass over that merge.

### Harness friction
1. **A ledger row on another branch went unseen.** Ledger row `2026-11-15-card-sets-carry-the-set-label`, minted on another branch the same day, asked for exactly the decision ADR 0028's Decision 5 made.
   - **Why it was missed.** Parallel sessions can't see each other's ledger rows until they merge. The ADR merged at 17:41, and the row reached staging at 19:15.
   - **A candidate `meta` row:** at Architecture and at Review, read the ledger rows staging has gained since the branch point (`git diff --name-only <merge-base> origin/staging -- ledger/`).
2. **The review template can't be met on this Mac.** It asks for the `npm run gate:status` line, but the full gate never runs on the Mac Studio, so the only answer is "no gate run records".
   - **A candidate `meta` row:** say what a review records when the gate runs only in the pull request's CI. For example, the CI run's id and verdict, added once it reports.
3. **Already recorded:** the worktree's missing `node_modules`, which W1, X1 and X2 need (`2026-11-16-route-walk-needs-node-modules`). No new row.

## Verdict
**CHANGES_REQUESTED**

**What holds.** The implementation is careful and close to its ADR. The gates are green, and every criterion has tests. The live check is thorough and well recorded, down to the race it found and then closed.

**What blocks.** Decision 5's label test counts the trust pipeline's card sets as sets. Wherever the trust pipeline has run, they are nearly all of the graph's `Set` nodes.
- link-set takes them in as sets and as parents.
- unlink-set then holds a card-set link made by mistake in place.
- A card set counts as a parent, so a set can be cut off from every concept with both guards passing.
- The check mode would report hundreds of thousands of false findings.

That defeats AC3's refusal of "any other node", and the invariant AC5 and AC7 exist for. A ledger row on staging asks for exactly this to be settled before more readers of `:Set` are written.

**The fix.** It is small and in one place, `kindOf`. But it changes Decision 5, so it goes through an amendment by the Architect first, then a test that fails, then the code.

**Next round.** I'll run the five suites, `node test/operations.test.js`, the lint and the card-set probe again. I'll check the amendment's words as a fresh claim.

## Close-out
Not applicable this round. The launching session asked for this one file, with no commit and no edit to the story.

## Round 2

**Date:** 2026-11-15
**Diff since round 1:** `a9dfe9fb..063b3549`. This story's own commits:
- `f77faea7`: ADR 0028 Amendment 3, approved by the owner;
- `80c59a41`: round 1's two harness lessons, as ledger rows;
- `3dff79ef`: nine failing tests (LS20, LS21, UL18 changed, UL19–UL21, CA10, SP11, SP12);
- `572c9b40`: the fix, and the Deviations it added to the story;
- `da0770c5`: a line on ledger row `2026-11-15-card-sets-carry-the-set-label`;
- `063b3549`: AC8's restore onto a fresh instance, recorded in the test plan.

`f66c37d8` merges staging at `18b5db81`, with no conflicts. Staging has since moved on to `28b55c6a`: PR #72 (story 11's list-elements) and PR #73 (a ledger row).

### Gates (run by reviewer, as in round 1)

Every run had dead endpoints exported. No `npm test`, no `:7778` and no docker.

- [x] **The five suites,** each in its own process: 65 of 65.
  - link-set 21/21 and unlink-set 21/21;
  - sets-agent-through-cli 1/1;
  - class-thread-acyclic 10/10 and set-has-a-parent 12/12.
- [x] **`node test/operations.test.js`,** with the temporary `node_modules` link made and removed in the same command: `operations: 402 passed, 0 failed, 0 skipped`, exit 0. W1 (both of them), X1 and X2 pass. The link was never staged, and the tree is clean afterwards.
- [x] **`bash scripts/harness-lint.sh`,** run before this round was appended: `harness-lint: clean (0 violations)`.
- [ ] **`npm test`** wasn't run, as in round 1, so `gate:status` still has no run to quote. Ledger row `2026-11-16-gate-status-unmet-without-local-gate` now records why. The full gate comes from the pull request's CI.
- [x] **The card-set probe**, on a scratch copy refreshed to `063b3549`. All four calls are now refused, and pet's class thread still reaches Goldie:
  1. link-set of a card set as `set`: `409 not-a-set`, its words saying a set has an address;
  2. unlink-set of that card set: `409 not-a-set`;
  3. link-set of Indoor pets under a card set: `409 not-a-parent`;
  4. unlink-set of Indoor pets from Pets: `409 last-parent`.
- [x] **A second probe, with card-set links seeded directly.** Step 4 above proves less than it did in round 1: step 3 is refused now, so no card set sits above Indoor pets. So this probe seeds the links the link-set before Amendment 3 could have made, then calls the operations and runs both rules as checks:
  - **(a)** taking a set out from under Pets, its one real parent, while a card set is above it too: `409 last-parent`, and pet's class thread still reaches the set's element;
  - **(b)** taking that set out from under the card set: `409 not-a-parent`, as test plan gap 9 records;
  - **(c)** a link that would close a loop only through a card set (`Above ─▶ Card set X ─▶ Below`, then Above under Below): `409 cycle`. The walks are unchanged (the story's Deviations), which is the safe side;
  - **(d)** taking Below out from under Pets, when its only other parent is a card set: `409 last-parent`;
  - **both rules as checks** over the seeded graph: no findings.
- [x] **Merges:**
  - **with current staging (`28b55c6a`),** the merge is clean. Over that merged tree, which includes story 11's suites, this story's 65 tests pass and `node test/operations.test.js` gives `operations: 447 passed, 0 failed, 0 skipped`, exit 0;
  - **with story 16's branch (`e10251ad`),** it has the same single textual conflict in `docs/GRAPH_RULES.md` as in round 1.

**Breaking the real code again,** one break at a time, on the refreshed scratch copy:

| Broken | Failed in round 1 | Failed in round 2 |
|---|---|---|
| the lock leaves its property | UL18 | UL18 |
| the prune check runs with no `before` | LS11 | LS11 |
| supersets lose their `superset-of:` descriptors | LS12, LS13, UL11, UL12 | the same |
| a superset isn't exempt from `last-parent` | UL9, UL11, UL12, SP5, SP8, SP9 | the same |
| no peer check | UL14 | UL14 |
| the prune covers every firmware concept | LS14 | LS14 |
| "own" leaves out the owner | UL6 | UL6 |
| link-set's re-check after the `MERGE` taken out | nothing | nothing |
| unlink-set's re-check after the `DELETE` taken out | nothing | nothing |
| unlink-set takes no lock | nothing | UL18 |
| `kindOf` reads labels alone (Amendment 3 undone) | — | LS20, LS21, UL19, UL20, UL21, CA10, SP11, SP12 |
| the lock after `requireEnds`, round 1's order | — | UL18 |

### The blocking finding, against Amendment 3

Each of the amendment's claims, checked as a fresh claim:

| Amendment 3 says | Checked by | Holds? |
|---|---|---|
| Staging holds 370,377 card sets among its 370,401 `Set` nodes, each with a tapestryKey but no address, no class-thread links and no Tapestry JSON | the ledger row's counts; `src/cns/addSetsOfMetricsCards.sh:26–30` | Yes. The counts are the ledger row's. |
| "a card set under a set counted as its second parent" (line 396) | round 1's probe | The direction is reversed: the card set was above the set, as its parent (new item 2) |
| Every kind of class-thread set has an address: firmware's, create-set's and add-subset's, a pulled peer's, those the graph operations make, and a concept header's superset. Card sets don't. | every write in `src/` that gives a node `Set` or `Superset` (the list below) | Yes |
| It is the ledger row's second fix, and story 8 already reads `:Set` this way | the ledger row; `src/lib/tapestry-derive.js:160` | Yes, nearly: story 8 counts "a uuid or an id" as an address. For every `Set` node today the two readings agree. |
| `kindOf` answers `'other'` for a node with no `uuid`, so both operations refuse a card set as `set` and as `parent` | `_sets.js:110–115`; LS20, LS21, UL19, UL20; probe steps 1–3 | Yes |
| `set-has-a-parent` counts no address-less node as a parent, judges none as a set, and its check reports no card set | `set-has-a-parent.js:36` and `:40`, through `kindOf`; SP11, SP12, UL21; the second probe | Yes |
| `class-thread-acyclic` judges no link with an address-less end | `class-thread-acyclic.js:40`; CA10; the second probe | Yes. A loop through a card set between two sets that have addresses is still refused, by design. |
| The refusals' words name a node with no address as one that isn't a set | `_sets.js:52–53` (the `when` texts) and the `say` messages at `:75–84`; LS20, LS21, UL19, UL20 | Yes |
| ADR 0011 (list-elements) adopts this reading of a set | ADR 0011 Amendment 2 on staging adopts it by reference; `list-elements.js:41` and `:105` read `uuid IS NOT NULL` | Yes (new item 3) |
| Item 1: the lock is the first thing `apply` does; a key that names no node locks nothing, and `unknown-node` follows | `unlink-set.js:73`; the lock statement only matches nodes; UL10; UL18, which now catches both breaks of the lock | Yes |
| Item 2: the re-check's refusal names the set and the parent it stays under | `unlink-set.js:100–103`, read. Only the race path reaches it (test plan gap 10). | Yes, by reading |
| Item 3: part (c) resolves set files only, and no shipped edge is affected | `_sets.js:303` onwards; all ten part-(c) edges link a set to a set; the definition still lists 64 links (22, 26, 10 and 6), and UL12 sweeps them | Yes |
| Item 4: the second race "is left the same way" as Decision 9's: "a check over the graph finds it" | `src/operations/rules/` and GRAPH_RULES.md, which hold no rule about redundant links; the audit routes, which list sets and paths; `prune-superset-edges`, a repair with no check mode | No: nothing finds it today (new item 1) |
| Item 5: the owner approved Amendment 1's order at the Test Design gate | recorded in Amendment 3, which the owner approved (`f77faea7`) | Recorded. A conversation can't be checked from the repository. |

The writes that give a node `Set` or `Superset` all go by `uuid`, except the card sets':
- create-set: `src/api/normalize/index.js:4339`;
- add-subset: `src/api/normalize/nodes.js:204–205`, a `MERGE` on `uuid`;
- the pull: `src/api/concept/pullClassThread.js:284`;
- a community superset: `src/firmware/install.js:1125`;
- create-concept's superset at `index.js:1340`, and normalize-skeleton's at `:389`;
- `src/manage/concept-graph/setup.sh:70` and `:78`, on imported list items whose `uuid` it sets at `:61`;
- story 16's `_eventless.js`, on its own branch, which creates each node with the letter's address.

The two card-set scripts are the only writes that make a `Set` with no `uuid`.

**Blocking 1 is resolved.** The code, the nine tests, both probes and the merge with staging all agree with the amendment's decision.

### Round 1's non-blocking items

1. **The concurrency guarantees.** Partly fixed.
   - **The lock** is now pinned: UL18 fails without it, and fails if it moves back after `requireEnds`.
   - **The two re-checks** are still reached only by a second writer, so live step 8 remains their only evidence. That is recorded (the test plan's edge cases, and gap 10), and accepted for that reason.
2. **AC6's order.** Accepted: Amendment 3 item 5 records the owner's approval. The two-step advice for a firmware or peer set's last parent stays as approved.
3. **The restore onto a fresh instance.** Fixed: it was run and recorded (`063b3549`, the test plan's step 7).
   - **The setup.** It used two throwaway instances, one at a time. B booted with fresh volumes and an assistant key of its own.
   - **The result.** `upload-backup` answered `sameInstance: false`. After the restore, B held A's key, the links as they were at the backup, all four change entries and dogs' history, and an unlink-set worked on the restored graph.
   - The record is consistent with the steps it lists.
4. **The lock's placement.** Fixed: Amendment 3 item 1, at `unlink-set.js:73`, and UL18 pins it.
5. **The prune's residual race.** Recorded, as Amendment 3 item 4, but with one inaccurate clause (new item 1).
6. **The race path's `last-parent` wording.** Fixed: it names the set and the parent (`unlink-set.js:100–103`). Only a second writer reaches it (gap 10).
7. **GRAPH_RULES.md line 73.** Fixed: it now says "doesn't check for a cycle".
8. **Part (c)'s element addresses.** Fixed: part (c) resolves set files only, and so does the seed helper.
9. **UL18's refused case.** Fixed: the refusal now comes inside `apply`, and the test finds the lock in its rolled-back transaction.
10. **Merging beside story 16.** Still applies, unchanged: one textual conflict in `docs/GRAPH_RULES.md`. Keep §4, then §5–6.

Round 1's harness friction is recorded: items 1 and 2 as ledger rows `2026-11-16-staging-ledger-rows-go-unseen` and `2026-11-16-gate-status-unmet-without-local-gate`. Item 3 was already a row.

### New in round 2

None of these blocks.

1. **ADR 0028 line 414, Amendment 3 item 4: "a check over the graph finds it".** Nothing does today.
   - **Why not.** `class-thread-acyclic`'s check finds Decision 9's cycle. But a link a reinstall would prune is found only by link-set's `firmware-prunes` refusal, which Option A deliberately kept out of the rules, so `rules check` (A10.31) won't run it. The audit routes list sets and paths only, and `prune-superset-edges` is a repair.
   - **Ask:** correct the clause. For example: "No rule finds it today: `firmware-prunes` is a refusal of link-set's, not a rule. A check for it is A10.31's to add, or seed-firmware's (A10.37) to make moot." Or open a ledger row for A10.31, so its builder doesn't take the race as covered.
2. **ADR 0028 line 396:** "a card set under a set counted as its second parent" has the direction reversed. **Suggest:** "a set under a card set counted the card set as its second parent".
3. **The address rule now has two homes:** `_sets.js:111`, and `list-elements.js:41` and `:105` on staging. ADR 0011 Amendment 2 ties them by reference.
   - They agree, except on a `uuid` that is an empty string, which nothing writes.
   - Each operation keeping its own reading is the epic's pattern for builders working in parallel, so there's no ask. A later change to the rule has to change both.
4. **A card-set link made before Amendment 3 can't be taken out by either operation** (test plan gap 9). Accepted.
   - Only the link-set before Amendment 3 could make one: today's routes name nodes by `uuid`, which a card set lacks.
   - That link-set ran only on this branch and its scratch stacks.

### Verdict, round 2
**PASS**

The blocking finding is resolved. Amendment 3's decision holds wherever I checked it:
- in the code;
- in nine tests that fail without it;
- in both probes;
- in the merge with current staging, where story 11 reads a set the same way.

Of round 1's ten non-blocking items:
- seven are fixed;
- two are accepted, for reasons now on record: the re-checks need a second writer, and AC6's order has the owner's approval;
- one, the conflict beside story 16, is informational.

The two wording errors new in Amendment 3 don't change what the code does. They're worth correcting before the ADR is read as the record of what covers the second race.

### Close-out
- **The story's Status** is the coordinator's to flip, in the review commit. With this round appended, the lint's L1 check reads this review as passed, and flags the story's `Approved` status until then.
- **Completion detection** is reported to the coordinator, not recorded here.
