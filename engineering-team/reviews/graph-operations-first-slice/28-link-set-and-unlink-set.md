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
