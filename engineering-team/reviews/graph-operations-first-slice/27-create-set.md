# Review: Story 27 — `graph create-set`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff origin/staging...HEAD`: merge base `e26eb36a`, HEAD `70a1edce`. It holds three commits and 11 files, +1637 −6:
- `8038dcc7`: the failing tests and a new seed, `test/helpers/createSetGraph.js`, approved at the Test Design gate;
- `df401507`: the Tester's one-line correction to `test/helpers/graphFake.js`, which the owner approved as a kick-back;
- `70a1edce`: the implementation, with the catalog row, the change fields' descriptions, the story's Deviations, the test plan's records and one ledger row.

`origin/staging` has since moved on to `b0a8537a`. What it gained since the merge base touches none of this branch's files: ADRs 0011, 0014 and 0021, stories 14 and 21, the epic, and one ledger row. `git merge-tree` merges the two cleanly.

**Against:**
- the story, [27-create-set.md](../../stories/graph-operations-first-slice/27-create-set.md), with its Deviations;
- [ADR 0027](../../decisions/graph-operations-first-slice/0027-create-set.md), Decisions 1–17;
- the [test plan](../../stories/graph-operations-first-slice/27-create-set.test-plan.md), with its Tester correction and its live-check record.

## Quality gates (run by reviewer, not trusted)

Every run had the service endpoints dead:
- `NEO4J_URI=bolt://127.0.0.1:9`, `REDIS_HOST=127.0.0.1` and `REDIS_PORT=9`;
- `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE` and `MEILI_URL_HOST` at `http://127.0.0.1:9`;
- `TAPESTRY_PORT=9` and `TAPESTRY_CONTAINER=no-such-container`.

Nothing touched docker, `:7778`, the `tapestry` container or a `tapestry-scratch` one.

- [ ] **`npm test`:** not run.
  - **Why:** on this Mac the local `tapestry` container is the live agent-memory instance, and the full gate writes to it (ledger rows `2026-11-14-harness-points-tests-at-agent-memory` and `2026-11-16-gate-status-unmet-without-local-gate`).
  - **Where it runs:** the pull request's CI. Only CI covers the suites outside `test/operations/`, and `test/operations.test.js` as a whole.
- [x] **The scoped gate:** all 51 suites under `test/operations/`, through `test/helpers/gateRunner.js` with the label `a1027-review`, on `70a1edce` with a clean tree. `npm run gate:status -- --label a1027-review` answers:

  `20261117T033358Z-66964-44fb [a1027-review] started 2026-11-17T03:33:58.973Z on 70a1edce — PASS, exit 0, 620 passed, 0 failed, 4 skipped, 51/51 suites`

  - create-set gives 35 passed, and its agent suite 1.
  - The suites that read the changed files are green too: link-set 21, unlink-set 21, sets-agent-through-cli 1, class-thread-acyclic 10, set-has-a-parent 12, create-element 33, change-entry-fields 3, write-path 13, graph-fake 26, history 8, list-elements 30 and list-relationships 26.
  - The 4 skips are `lifecycle/shared-keys`' live checks: "TAPESTRY_KEYS_LIVE=1 is not set".
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)`, exit 0, run before this file was written.
- [x] _Playwright: not applicable, since there is no UI._
- [x] _Lint, typecheck and build: not configured, so skipped._

### Checks beyond the gate

Each ran in a copy of a commit made with `git archive`, in the session's scratchpad outside the repository, with `node_modules` linked in. Nothing from them is committed, and the worktree stayed clean.

1. **The tests fail first.** At `8038dcc7`, before any implementation, create-set gives `1 passed, 34 failed`. The one that passes is CS19, as the plan says. The agent suite gives `0 passed, 1 failed`. Both match the plan's record.
2. **The fake's correction is needed, for the reason it gives.** HEAD's code over `graphFake.js` as it was at `8038dcc7` gives `19 passed, 16 failed`. Every failure is "a SET it can't read ({uuid: $uuid, kind: $kind, pubkey: $pubkey, name: $name, tapestryValue: $name, …".
3. **Breaking the real code.** I applied 37 breaks to `create-set.js` and `_sets.js`, one at a time, and ran each against `create-set.test.js`. 31 are caught:

   | Broken | Caught by |
   |---|---|
   | no lock; the lock after `requireParent`; the lock on another node (`create-set.js:188`) | CS14 |
   | the name not cleaned (`:180`) | CS9 |
   | the not-installed check skipped (`:195`) | CS31 |
   | `threads` read over the set concept's superset (`:196`) | CS1, CS6, CS7, CS8, CS10 |
   | a repeat that records an entry (`:214`); a repeat that answers no letter (`:207`) | CS10, CS12; CS12 |
   | a held address refused instead of nonced (`:220`) | CS13 |
   | the address taken from the parent's key, not its uuid (`:220`) | CS1, CS2, CS6, CS9, CS13, CS26, CS28 |
   | no rule check (`:228`) | CS29, CS30 |
   | no parent link (`:240`); no registration (`:241`) | CS4, CS5, CS10, CS11; CS4, CS5, CS33 |
   | no marks (`:244`) | CS33 |
   | no other concepts in `concepts` (`:246`) | CS3, CS33 |
   | no note (`:259`); an entry with no `from` (`:261`) | CS1; CS1, CS5 |
   | R7 counts another author's set (`_sets.js:519`) | CS13 |
   | R7 without its address match, or without its nonce match (`:520`) | CS12 |
   | the plain address not preferred; the highest key taken (`:531`) | CS12 |
   | `differs` ignores the name's case (`:549`); `differs` never names the description (`:551`) | CS11, CS20; CS11, CS12, CS20 |
   | `json` before `description`; no `z`; no `s` (`:505`) | CS2 and CS20, with CS6 for `s` |
   | no word block (`:500`) | CS2, CS3, CS20, CS33 |
   | `requireParent` takes a concept header or a card set as a parent, or words its refusal its own way (`:472`) | CS23 and CS34, with CS28 for the header |

   Six aren't caught. Each leaves all 35 tests passing:

   | Broken | Why nothing fails | Finding |
   |---|---|---|
   | R7 without its name match (`_sets.js:520`) | every set the tests find by name also sits at the address its name gives | Blocking 1 |
   | R7's name match made case-sensitive (`:520`) | the same | Blocking 1 |
   | R7 without `NOT s:Superset` (`:519`) | the seed's Hounds isn't labelled `Set`, so R7's `(s:Set)` leaves it out before the guard is reached | Non-blocking 2 |
   | `differs` skips a description when the set has none (`:551`) | no repeat gives a description to a set that has none | Non-blocking 3 |
   | a repeat answers `[parent]` as its `parents` (`create-set.js:207`) | no repeated set has a second parent | Non-blocking 3 |
   | `wordTypes` reversed instead of sorted (`_sets.js:497`) | CS20's other keys, `zoo` then `collection`, come out sorted when reversed | Non-blocking 3 |

   link-set's own suite doesn't catch the three `requireParent` breaks either, as expected: link-set doesn't call `requireParent`. CS34 is the test that holds the two readings together, and it catches all three.
4. **A probe of the by-name repeat:** see Blocking 1.

## Spec adherence

| AC | Evidence | Result |
|---|---|---|
| AC1, make a set | CS1, CS2, CS4–CS7, CS9, CS15; live L1, L3 and L9 | Met |
| AC2, its JSON and rule 4 | CS3, CS20, CS29, CS30, CS33; live L4 | Met |
| AC3, safe to repeat | CS10–CS14, CS20; live L1 and L5 | Met by the code, as the probe shows. But the repeat by name has no test that fails when it breaks (Blocking 1), and neither do `holds: null` or a repeated set's second parent (Non-blocking 3) |
| AC4, what it refuses | CS8, CS21–CS28, CS31, CS32; live L2 | Met |
| AC5, one reading of a set | CS34: 13 candidates, the same 7 taken and the same 6 refused, in the same words. CS20. All three `requireParent` breaks are caught | Met |
| AC6, it lasts | CS2 (the `z` tag) and CS4; live L6 and L7 | Met, as observed. What keeps the registration through a reinstall is Pass 3, not pass 1d (Non-blocking 1) |
| AC7, it reaches agents | CS15–CS18, CS21, CS35, XS1; live L8 | Met. `clients/` is untouched |

- [ ] **Every acceptance criterion has a passing test.** Each does, but AC3's name match has no test that fails when it breaks (Blocking 1).
- [x] **No criterion is silently dropped.** AC3's "two calls at once" is beyond the fake, which runs one transaction at a time, and the live check's L5 covers it, as the plan says.
- [x] **No behaviour beyond the story.** The marks (Decision 12) come from ADR graph-operations-foundation/0005, which applies to every element write, and the ADR says so.

**The story's seven Deviations,** each checked against the code and accepted:
1. **R6 and `threads` live in `create-set.js`** (`:60–73`, `:81–84`). `_sets.js` gains exactly the seven functions (`:467–566`, exported at `:592–598`).
2. **The reused refusals** (`create-set.js:30–34`). Their `when` texts fit a set, and the messages are worded for one (`:42`, `:51`, `:221`).
3. **The set concept's `key: 'set'`** (`:245`) is Decision 9's fixed key, and Decision 6's address match keeps it fixed.
4. **`threads` in code-unit order** (`:83`). tapestryKeys are lowercase UUIDs, so code-unit order and locale order agree.
5. **`_sets.js` requires `conceptNames.js` when it loads** (`:45`). That module requires only `./dtag`, which requires only `crypto`, so `_sets.js` still opens nothing when it loads.
6. **A blank description counts as left out** (`create-set.js:52`, `_sets.js:551`). This is Decision 3's "empty once trimmed counts as left out".
7. **The live check ran on the image's firmware.** `scripts/scratch-stack.sh:80` mounts `src/` alone, read-only.

**Unlisted deviations:** none that change behaviour. The code's R6 and R7 are the ADR's text, with the aliases interpolated, and CS19 runs the ADR's text over the fake.

## ADR adherence

- [x] **Decision 1, the inputs** (`create-set.js:120–124`, `:169`, `:172–173`):
  - `parent` comes through `N.keyInput`;
  - `name` takes up to 1,000 characters as given, and `description` up to 10,000;
  - `repeatKey` is `['parent', 'name']`, and the guard is the rule with empty items.

  CS16 reads all of these off the listing.
- [x] **Decision 2, the steps**, in order:
  1. the name, the description and the assistant (`:180–184`);
  2. the lock (`:188`);
  3. the parent (`:191`);
  4. the set concept (`:194–195`);
  5. the repeat (`:199–216`);
  6. the address (`:220–221`);
  7. the JSON and the rule (`:224–228`);
  8. the node and its links (`:231–241`);
  9. the marks, the concepts and the entry (`:244–261`).

  `threads` is read between steps 4 and 5 (`:196`), after the lock, which changes nothing. Nothing but the lock, which leaves the parent as it was, is written before `:231`, and the write path rolls back every refusal anyway (CS28–CS32).
- [x] **Decision 3** (`:39–53`) cleans as create-concept's `cleanInputs` does (`_concepts.js:109–124`), with a blank description counting as left out.
- [x] **Decision 4, the parent.** `requireParent` (`_sets.js:467–474`) is the parent half of `requireEnds` (`:233–242`): `N.requireNodes`, then `nodeOf` and `kindOf`, then `say.notAParent` with `supersetOf`. `requireEnds` is unchanged, and CS34 holds the two together.
- [x] **Decision 5, the lock,** is the first statement of `apply`. The write path's only guard has empty items, so it reads nothing before the lock (`src/operations/write.js:32–37`, `src/operations/rules/element-fits-schema.js:48–49`). CS14 checks both the order and the node locked, and catches all three lock breaks.
- [x] **Decision 6, R6** (`create-set.js:60–73`). It is the ADR's statement with the `INIT` alias, and `not-installed` names the set concept's address (CS31).
- [x] **Decision 7, R7** (`_sets.js:515–544`). It is the ADR's text with the `PROP` alias, the order is at `:531`, and `setDiffers` is at `:547–553`.
- [x] **Decision 8, the address** (`create-set.js:199`, `:220–221`): `childDTag(name, <the parent's uuid>)`, then `freeAddress` up to `~99`. This is the address today's two routes give (`src/api/normalize/nodes.js:167`, `src/api/normalize/index.js:4368–4369`).
- [x] **Decision 9, the JSON.** `setJson` (`_sets.js:495–501`) keeps the keys in order and takes the title from `toTitleName`. Its `wordTypes` are word, set, then the others sorted. Then `checkElements` runs (`create-set.js:228`), which refuses with `rule` (`_schemas.js:181–188`).
- [x] **Decision 10, the node and its tags.** `makeNode` gets `['ListItem', 'Set']`, kind 39999 and the assistant, and no `id` (`create-set.js:231–239`). `setTags` (`_sets.js:504–506`) has add-subset's order (`buildSubsetTags`, `nodes.js:72–75`) and today's create-set's (`index.js:4385–4396`), then `json`.
- [x] **Decision 11, the links:** `linkUnder` (`_sets.js:477–487`), then `X.link` (`create-set.js:240–241`). Each throws unless it joined exactly one pair.
- [x] **Decisions 12–14:** the marks (`:244`, `:257–258`), the answer (`:204–215`, `:250–260`) and the entry (`:261`). The field descriptions are at `src/operations/changes.js:39` and `:47–48`.
- [x] **Decision 15's table** matches the listing (CS16), and `invalid-input` is the router's (CS27).
- [x] **Decision 16:** the live check's L6 and L7. Non-blocking 1 covers what actually keeps the registration.
- [x] **Decision 17:** the catalog row. `/docs`, the list and the command all come from the declaration (CS15, CS16), and `clients/` is untouched (XS1).
- [x] **The files match the Implementation notes.**
  - `_sets.js` gains only additions: at its end, in its header's index (`:34–42`) and in `module.exports`.
  - `requireEnds`, link-set and unlink-set are unchanged.
  - The one file outside the notes is `graphFake.js`, the owner-approved correction.
  - There is no new dependency: `package.json` is untouched.

## The change to `test/helpers/graphFake.js`

- **What it does** (`:264`). `createEntry` now looks for a `SET` clause only after the node's pattern, not anywhere in the statement.
- **It is correct.** Neo4j reads `:Set` in `CREATE (n:ListItem:Set {…})` as a label. The old search covered the whole statement, case-insensitively, so it took the label for a clause, as check 2 above shows.
- **It is safe for the other suites:**
  - every suite under `test/operations/` passes with it, graph-fake's own 26 included (the gate above);
  - the dispatcher (`:522`, `:528`) is unchanged, so which statements reach `createEntry` doesn't change;
  - for every statement that reaches `createEntry`, the first `SET` after the node's pattern is the one the old search found, unless the statement has a `SET` before its `CREATE`. A scan of every template statement in `src/operations/` finds none with that shape.
- **One loosening:** see Non-blocking 5.
- **It changes no assertion.** `git diff 8038dcc7 70a1edce -- test/` is this one file, and its header (`:71–73`) says what changed.

## Concept-graph integrity

- [x] **Handles are in `kind:pubkey:slug` form.** The set concept, `39998:<TA>:set`, comes from `firmware.conceptUuid('set')` (`create-set.js:61–62`). The set's address, `39999:<TA>:<d>`, takes the assistant from `K.assistant()` (`:183`, `:199`). The diff has no 64-hex literal.
- [x] **No firmware reinstall is needed.** No concept definition changes, and the rulebook gains no rule, as the ADR says.
- [x] **Orientation:** the ADR's Context reads `/api/concept-graph/summaries` and `/neighbors`.

## Things tests can't catch

- [x] The new source has no secrets, no literal pubkey, no `console.*`, no TODO and no commented-out code.
- [x] **Error paths.** Every refusal comes before the first write, and the write path rolls back. The two 500s are shaped as `requireEnds`' and `X.link`'s: a parent missing after it was found, and a link that joined other than one pair.
- [x] **Concurrency,** checked by reading:
  - **two create-sets under one parent** take the parent's lock in turn, and the second finds the first's set (live L5);
  - **creates under different parents** meet only at the set concept's superset, which `X.link`'s `MERGE` locks last, so they don't deadlock;
  - **a create-set and a create-element into the same set** both lock that set: one through the lock, the other through `X.link`'s `MERGE`. So they run in turn, harmlessly;
  - **a deadlock** is possible only with a link-set that locks the set concept's superset before the parent, and the driver retries the transaction (Decision 5).
- [x] **Injection.** Every input is a parameter. The only names interpolated are firmware's relationship aliases and `_eventless.js`'s fixed labels.
- [ ] **Cost:** one more unlabelled scan per create (Non-blocking 4).

## Architecture invariants

- **POV-first.** Nothing per-POV is computed or stored: `threads` and `concepts` are read on each call.
- **Permissionless publishing.** Any author's parent takes a set (CS8). Another author's set is never the repeat, so this instance's own claim sits beside theirs (CS13).
- **Filter at read time.** The set's `wordTypes` record the concepts that reach the set concept's superset when the set is made. That is create-element's approved rule (ADR 0020; D10), not a per-POV result.
- **Local-first (BIBLE §30).** The set is Neo4j-only state, and the answer says so (CS1). It survives a reinstall and a restore (live L6 and L7).
- **The TA pubkey** is read at runtime only, and nothing signs: CS15's spy, CS35, and the relay's count in live L9.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence

_Not applicable: the book has no PRD._

## Docs

- **The catalog row** (`docs/GRAPH_OPERATIONS_CATALOG.md:122`) gives the inputs, the report and the refusals, and the Today column is unchanged. It leaves out `not-installed`, as create-element's and create-concept's rows do.
- **`changes.js:39` and `:47–48`:** `from`, `name` and `slug` now cover a set made under a parent (CS17).
- **The declaration's texts** (`create-set.js:114–124`) say what the code does.
- **The test plan's records.** The fail-first record and the correction's cause hold (checks 1 and 2). Two claims don't: the coverage map's AC3 row (Blocking 1) and the Hounds edge case (Non-blocking 2).
- **The ledger row edit:** its observations hold, its conclusion doesn't (Non-blocking 1).

## Findings

### Blocking

1. **AC3's repeat by name has no test that fails when it breaks.**
   - **Where:**
     - the tests: CS12 (`test/operations/graph/create-set.test.js:326–343`), over the seed (`test/helpers/createSetGraph.js:164–165`);
     - the claim: the coverage map's AC3 row (`27-create-set.test-plan.md:21`);
     - the code it should hold: R7's name match (`src/operations/catalog/graph/_sets.js:520`).
   - **What the plan says:** CS12 finds the repeat "by name (today's lettered Show Dogs, add-subset's Puppies) or by the address the name gives".
   - **Why it doesn't.** Show Dogs and Puppies sit at the plain address their names give under beagle's superset, so R7 also finds them by `s.uuid = $address`. So does every other case that matches by name: Kennel Club in each case, the twins, the echoes, and the agent's Field Trials. No case has a set that only its name finds.
   - **The breaks:** with `toLower(s.name) = $name` dropped from R7, create-set still gives 35/35 and the agent's suite 1/1. With the name matched case-sensitively, create-set still gives 35/35.
   - **Why it matters.** The name is what finds a set sitting at an address that isn't the one its name and the parent give. That is:
     - a set link-set put under the parent, which keeps the address its first parent gave it;
     - one of firmware's sets, whose d-tag is its file's `word.slug` or its file's name;
     - a set today's create-set made with an explicit or random d-tag.

     "Safe to repeat by name under the parent" is the catalog's promise for this operation. `findSetRepeat` is now also shared, for delete-set (A10.17) and move-element (A10.23), so it will be edited again.
   - **The probe,** through the suite's own harness:
     - **The setup:** one own set, Linked In, under lap pets and under beagle's superset, at the address lap pets gives it. Then create-set Linked In under beagle's superset, and again as "linked in".
     - **On HEAD:** both calls answer `already-exists` with Linked In and both its parents. The second has `differs` naming the name's case. One Linked In remains.
     - **With R7's name match dropped:** the first call answers `created`, and a second Linked In appears at `…:linked-in-6d1a0e8c`. Two Linked Ins remain, and every test still passes.
   - **Asked change.** This is the Tester's, with the owner's approval, as this story's correction at Implementation was:
     - seed one own set directly under beagle's superset, at an address its name and that parent don't give, as the probe's Linked In;
     - add two cases to CS12: its name as stored, and its name in another case. Each answers `already-exists` with that set, and the second has `differs` naming the name;
     - check that both cases fail when `_sets.js:520`'s name match is dropped, and when it is made case-sensitive;
     - correct the coverage map's AC3 row.

     The code needs no change: the cases pass on it, as the probe shows.

### Non-blocking

1. **The ledger row's new paragraph draws the wrong conclusion** (`ledger/2026-11-15-reinstall-drops-a-supersets-own-membership.md:20–24`).
   - **What holds:** its observations. The live check's three sets, and firmware's own sets, keep `set-superset`'s `HAS_ELEMENT` through a reinstall.
   - **What doesn't:** its conclusion, "Whatever pass 1e does, it doesn't drop a set's membership in `set`". That isn't what the code does, read end to end:
     - **Pass 1e** counts paths of any mix of the two link types (`src/firmware/install.js:856`). So `set-superset -HAS_ELEMENT-> parent -IS_A_SUPERSET_OF-> set` is a path of two, and the pass deletes the set's direct `HAS_ELEMENT` (`:862–866`). The set concept has a `manifest.json`, so the pass covers it (`:828–829`).
     - **Pass 3** then calls `wire-implicit-elements` (`install.js:1291`). For each node whose `z` tag names a concept (`src/api/normalize/index.js:5874`), it counts the node as already wired only if some path ends in a `HAS_ELEMENT` into it (`:5886–5893`). A set's other way in ends in `IS_A_SUPERSET_OF`, so its registration is put back (`:5900–5903`).
     - **The row's own superset case is the opposite.** `superset-superset -HAS_ELEMENT-> set-superset -HAS_ELEMENT-> tea-house-superset` ends in a `HAS_ELEMENT`, so Pass 3 counts it as wired, and the membership stays lost.

     So the set case fits the row's suspected cause, rather than arguing against it.
   - **For AC6.** A set whose parent is itself an element of `set` (any set, and the supersets firmware and create-concept make) keeps its registration because Pass 3 restores it from the set's `z` tag (Decision 10's third tag, which CS2 holds). Pass 1e doesn't leave it alone. Two consequences:
     - Pass 3's failure is caught and logged, and the install goes on (`install.js:1289–1295`). Such a reinstall ends with the registration gone.
     - Decisions 11 and 16 name pass 1d, which runs before pass 1e (`install.js:650`, `:810`), so it can't restore what 1e takes out.
   - **For whoever fixes pass 1e.** A change to `wire-implicit-elements`' check, or to Pass 3, could drop every such set's membership. A fix to pass 1e of the row's own fix shape keeps it.
   - **Caveat:** this is a reading of the code, not a run.
   - **Optional, best done in Blocking 1's round:**
     - replace the paragraph's last sentence with what was observed and this mechanism, marked as a reading;
     - a dated line in ADR 0027 Decision 16 naming Pass 3, which is the Architect's to write;
     - on the next scratch reinstall, confirm the reading from its output: `set: pruned N HAS_ELEMENT …` (`install.js:900`), then `Implicit elements wired: N` (`:1292`).
2. **R7's `NOT s:Superset` isn't held by any test** (`_sets.js:519`).
   - **The claim.** The plan's edge case says Hounds tests "only sets count" (`27-create-set.test-plan.md:36`).
   - **Why it doesn't.** The seed labels Hounds `Superset` but not `Set` (`createSetGraph.js:173`), so R7's `(s:Set)` leaves it out before the guard is reached. Dropping the guard leaves every test passing.
   - **Why the guard matters.** Nodes with both labels exist wherever the old concept-graph setup ran. It labels by `z` tag (`src/manage/concept-graph/setup.sh:70`, `:78`), and a superset's `z` tags name both concepts (`install.js:651`). That is why `kindOf` checks `Superset` first.
   - **Optional,** in Blocking 1's round: label Hounds `Set` too.
3. **Three smaller gaps, each shown by a break every test survives:**
   - **`holds: null`** (Decision 7; `_sets.js:551`): no repeat gives a description to a set that has none. Odd Ones! given a description would.
   - **A repeat's `parents`** (Decision 13; `create-set.js:207`): no repeated set has a second parent, so answering `[parent]` passes. Blocking 1's Linked In, under two parents, would hold it.
   - **`wordTypes`' order** (`_sets.js:497`): CS20's other keys, `zoo` then `collection`, are in reverse sorted order, so reversing them passes. An order such as `b, c, a` would hold it.

   Optional, in the same round.
4. **One more unlabelled scan per create** (`create-set.js:225`).
   - `K.headersByKey` matches `(h)` with no label (`_concepts.js:447`), so it can't use the `tapestry_key` index. create-set calls it once per create: for word, on firmware 1.0.0.
   - Ledger row `2026-11-16-headers-by-key-scans-unlabelled` lists create-element, the rebuild and create-concept as its callers, but not create-set.
   - Optional: add create-set to the row's list.
5. **The fake's narrower search now ignores a `SET` before the node's pattern** (`test/helpers/graphFake.js:264`). The old search read such a clause and refused it. Nothing in `src/operations/` has that shape, so nothing changes today, but graph-fake's own suite has a case for neither reading.
   - Optional: two cases in `test/operations/graph-fake.test.js`. One for `CREATE (n:ListItem:Set {…})`. One showing that a `SET` before the pattern is refused, with `createEntry` taught to refuse it.

### Harness friction

1. **A case can satisfy two branches at once and test neither.**
   - **The gap.** The Tester checks that new tests "fail for the right reason" (`engineering-team/roles/tester.md:23`, `engineering-team/workflows/3-test-design.md:13`). Before the code exists, every test fails at the missing module. So that check can't show that a case isolates the branch the coverage map credits it with.
   - **Where it bit.** Blocking 1 is the result here. Review 28 likewise found its uncaught breaks only by breaking the real code at Review.
   - **A candidate `meta` row:**
     - when a criterion names alternatives ("the name … or the address"), each alternative gets a case that only it satisfies;
     - before Review, the Implementer breaks each named branch once and records what catches it.
2. **Known, seen again:** there is no local full gate on this Mac. The scoped gate's record does give a `gate:status` line for the suites that can run here. No new row.

## On PASS (same commit)

- [ ] _Not applicable: the verdict is **CHANGES_REQUESTED**, so the story stays `**Status:** Approved`. The launching session asked for this one file, with no commit and no edit to the story._

## Verdict

**CHANGES_REQUESTED**

**What holds.**
- create-set does what ADR 0027 decided, in its order and with its codes:
  - the lock on the parent comes before any read;
  - the parent is read as link-set reads one;
  - the repeat is this instance's own set under the parent;
  - the address takes a nonce when held;
  - the JSON is checked by rule 4 before anything is written;
  - the tags, the two links, the marks and the entry are as decided, and nothing signs.
- The story's seven Deviations hold, and the fake's correction is right and safe for every suite that uses it.
- The 51 operations suites are green on HEAD, and the tests failed first, as the plan records.
- 31 of 37 breaks of the real code are caught.
- The live check's record covers what the fake can't: two calls at once, a reinstall, a restore on a fresh instance, nginx and the relay.

**What blocks.**
- AC3's repeat by name, the operation's headline promise, has no test that fails when it breaks.
- Every test case found by name is also found by its address, so dropping the name match leaves every suite green. The probe shows the result: a second set of the same name under the same parent.
- The plan's coverage map says CS12 covers it.

**The fix** is the Tester's, and needs no code: one seeded set at another address, and two cases. Non-blocking 1–3 fit in the same round, and the rest are optional.

**Next round.** I'll run the new cases against the two name-match breaks, run the operations suites again, and check the plan's corrected AC3 row as a fresh claim.
