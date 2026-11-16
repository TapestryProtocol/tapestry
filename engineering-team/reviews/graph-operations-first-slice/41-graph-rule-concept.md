# Review: Story 41 — The graph rules as a concept on every instance, made from the rulebook

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff a35fd054..HEAD`, HEAD `2b20ca0a`. It holds three commits, `db933df0` (tests), `b2948904` (implementation) and `2b20ca0a` (evidence and deviations), and 22 files, +2008 −5. `a35fd054` is staging's merge of #81, which brought in the approved story and ADR.
**Against:**
- the story, [41-graph-rule-concept.md](../../stories/graph-operations-first-slice/41-graph-rule-concept.md): AC1–AC6, its resolved questions and its Out of scope;
- [ADR 0041](../../decisions/graph-operations-first-slice/0041-graph-rule-concept.md), Decisions 1–8 and Amendment 1;
- the [test plan](../../stories/graph-operations-first-slice/41-graph-rule-concept.test-plan.md) and its three suites;
- [ADR graph-rules/0001](../../decisions/graph-rules/0001-graph-rules-tips-and-glossary-entries.md), CLAUDE.md's four invariants, and the rule that the assistant's pubkey is read at runtime.

**Verdict:** CHANGES_REQUESTED, on one blocking finding: BIBLE §7 says the opposite of what install does with an item edited in the graph.

## Quality gates (run by reviewer, not trusted)

This Mac's rules applied: no full `npm test`, and nothing written to, installed on or exec'd into the `tapestry` container.
- The stack-free runs had `TAPESTRY_CONTAINER` unset.
- The neighbouring suites also had every endpoint at a closed port: a conf with `NEO4J_URI=bolt://127.0.0.1:9`, and the API and base URLs at `127.0.0.1:9`. This matters because the `tapestry` container publishes bolt on `0.0.0.0:7687`, which is where an unconfigured driver would connect.

The gate:
- [ ] **`npm test`** was not run: on this Mac it writes to the owner's agent-memory instance.
  - `npm run gate:status` answers `No gate run records in …/vigilant-shirley-043c82/tmp/gate-runs` (exit 2), so there is no run id or verdict to quote (ledger `2026-11-16-gate-status-unmet-without-local-gate`).
  - The full gate runs in the pull request's CI.
- [x] **The story's three suites,** each run on its own:
  - `graph-rules-builder: 22 passed, 0 failed, 0 skipped`;
  - `graph-rule-firmware: 13 passed, 0 failed, 4 skipped` stack-free (GL1–GL4 skip with no scratch container), and `17 passed, 0 failed, 0 skipped` against my scratch instance with `GRAPH_RULE_INSTALL=1` (check 3 below);
  - `firmware-element-sync: 14 passed, 0 failed, 0 skipped`.
- [x] **Neighbouring suites,** each run on its own. These read what the diff changes: install.js (as text, or its Pass 2 in a child process with a fake driver), the manifest, the rulebook, the rules folder, or the Cypher in `src/`.
  - `node test/operations.test.js`: `operations: 509 passed, 0 failed, 4 skipped`. That includes the five rules suites, tapestry-key-paths and lifecycle status.
  - schema-save-finds-the-right-header 26 passed (2 skipped); b-tag-primitive 16; b-tag-seeds 7; community-reference-nostr-relay-stub 4; community-reference-superset-link 4; community-class-thread-pull 10; default-deny-mutations 14; my-assistants-map 14; event-tagging-core 15; harness-lint's suite 85. None failed.
  - Not run here: the suites whose live parts default to the `tapestry` container or to `:7778`. They are event-less-create-set, relationship-primitives, not-yet-shared-filter, event-tagging-firmware-seed, close-unauth-write-surface, brains-launcher-repo and create-concept-duplicate-check. CI runs them.
- [x] **`node src/firmware/graph-rules.js --check`:** exit 0, `graph-rules: the 6 items in firmware/active/concepts/graph-rule/elements are current.`
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)`.
- [x] **The merge:** `git merge-tree --write-tree origin/staging HEAD` is clean.
  - That is against the local `origin/staging`, `cd63229a`, 50 commits past `a35fd054`. I didn't fetch, since this review makes no GitHub calls.
  - Staging has touched none of these since `a35fd054`: the rulebook, `src/operations/rules/`, the firmware manifest or concepts, BIBLE.md, `src/firmware/`, the normalize helpers and `test/registry.js`. So the counts the suites pin (six entries, the concept order, 41 concepts) still hold after a merge.
- [ ] `npm run test:playwright` doesn't apply: there is no UI change.
- [ ] _Lint not configured — skipped._ _Typecheck not configured — skipped._ _Build not configured — skipped._

### Three checks beyond the gate

These used scripts in the session's scratchpad. Nothing from them is committed.

**1. Pass 1b, with its dependencies stubbed.** `pass1_bootstrap()` ran with four modules replaced in `require.cache` (`src/lib/neo4j-driver`, the normalize helpers, `eventSync` and `assistantKeys`) and with `fetch` replaced, so nothing could leave the process. Each graph-rule element was given its own state:

| What the lookup found | What install did |
|---|---|
| no element (`tapestry-key-unique`) | called create-element with concept "graph rule", for this element only |
| the assistant's element, holding the file's JSON with its keys reordered | signed nothing; no create-element |
| the assistant's element, holding other JSON (`field-mark-allowed`) | one `loadTAKey`, then `regenerateJson` once, at `39999:<TA>:field-mark-allowed-…` |
| only another author's element (`concept-slug-unique`) | signed nothing; no create-element; logged "Not made: …" |
| an error from the lookup (`class-thread-acyclic`) | recorded the error; didn't fall through to create-element; went on with the install |
| the assistant's element (same JSON) and another author's | signed nothing |

All six lookups passed the header's address, `39998:<TA>:graph-rule`. The other 40 concepts made 76 create-element calls, one for each of their element files, and no direct reads.

**2. The parser, against plausible future edits.** Each edit was made on its own to the real rulebook, then run through `parseRulebook` and `itemsFor` with the real rules:

| Edit | Result |
|---|---|
| a proposed entry 7, written correctly | seven items, no problem |
| its heading without the full stop, `` ## 7 `set-has-a-name` `` | the entry is dropped: six items, no problem |
| its heading as `` ## Rule 7: `set-has-a-name` `` | dropped, no problem |
| entry 7 under a `## Letter rules` section, as `### 7. …` | dropped, no problem |
| a trailing space after its heading | a problem, with rule `null` |
| `---` between entries | five items' `source` becomes, for example, `"ADR graph-operations-foundation/0003.\n\n---"`; no problem |
| a note after entry 6, not indented | `set-has-a-parent`'s `source` becomes `"ADR graph-operations-first-slice/0028.\n\nNote: rules 5 and 6 share a walk"`; no problem |
| an extra field written `- **Example**: …`, with the colon outside the bold | it joins the field before it, `alsoSays` stays empty, and there's no problem |
| a Says beginning "no set (e.g. a superset) is below itself." | `word.description` is `"No set (e.g."` |
| CRLF line endings | the same six items |

Today's rulebook parses exactly (GB2–GB7). A dropped entry goes unnoticed only when it has no code file, because a rule file with no entry is a problem (GP1).

**3. Live, on a scratch instance.** I booted it with `SCRATCH_IMAGE=agent-memory-tapestry:latest scripts/scratch-stack.sh up`. That mounts this branch's `src/`, and the script's own first install used the image's firmware. I then copied this branch's `firmware/versions/v1.0.0/` in and restarted the control panel. The instance's assistant was freshly made.
- **Install 1** (72 s) logged `graph-rule: 6 to create, 0 re-signed in place, 0 already in line, 0 not made`. Each of the six items was at `39999:<TA>:<name>-bf35e21a` and held its committed file's JSON.
- **Two changes before the next install:**
  - I edited `set-has-a-parent` in the graph through `POST /api/normalize/save-element-json`, the element page's save (`ElementDetail.jsx:164`). That signed a new event. Its file didn't change.
  - I changed `class-thread-acyclic`'s file, in the container's firmware only.
- **Install 2** (66 s) logged `graph-rule: 0 to create, 2 re-signed in place, 4 already in line, 0 not made`.
  - Both re-signed items kept their address and their `HAS_ELEMENT`, and the other four kept their events.
  - `set-has-a-parent`'s edit is gone: its json tag equals its file, which never changed.
  - `class-thread-acyclic`'s json tag has the new words, but its LMDB entry (`GET /api/tapestry-key/<key>`) still has the old ones.
- **After restoring the file,** an install logged `1 re-signed in place, 5 already in line`. Then `TAPESTRY_CONTAINER=tapestry-scratch GRAPH_RULE_INSTALL=1 node test/graph-rule-firmware.test.js` passed 17 of 17. The install GL4 runs logged `0 re-signed in place, 6 already in line`.
- **Removed** with `scripts/scratch-stack.sh down`. No scratch container or network remains.

## Spec adherence

- [x] Every acceptance criterion has a passing test. One sub-check, AC6's UI page, wasn't observed by anyone (non-blocking 6).
- [x] No criterion is silently dropped.
- [x] No behavior was added that isn't in the story or the ADR.

| AC | Tests | Also checked |
|---|---|---|
| AC1, the concept | GF1–GF3, GF5, GF6, GF8; GL1 | The description is ADR graph-rules/0001 Decision 1 word for word, followed by Decision 5's point. Live, GL1 found eight core nodes, as relationship-type has. |
| AC2, one item per entry | GB2, GF9, GF10, GF12; GP9, GP10; GL1, GL2 | Live: six items, each found by its rule's name. |
| AC3, what an item says | GB3–GB5, GB7, GP8, GP11, GF4, GF9; GL2 | Entry 1's `code` is `null`. The other five hold their declarations in the code's order. |
| AC4, made, not kept | GB6, GB8, GB9, and GP1–GP7, each problem naming its rule | Live: a changed file's words reached the item's event and json tag, but not its LMDB entry (non-blocking 5). |
| AC5, a reinstall brings an instance in line | ES2–ES11, IS1–IS3, GF6, GF7; GL4 | Stubbed: all four outcomes, and no other concept affected. Live: addresses and relationships kept, and the four unchanged items not re-signed. An edit made in the graph is put back, as the story's Out of scope says, but BIBLE says otherwise (blocking 1). |
| AC6, it reads like any concept | GB10, GF13; GL1, GL3 | The UI page wasn't opened (story Evidence, line 109; non-blocking 6). |

## ADR adherence

- [x] The files match the Implementation notes:
  - new: the two modules and the concept's folder;
  - changed: the manifest, install.js's Pass 1b only, the rulebook and BIBLE §7.
- [x] Layering:
  - `planElement` is pure.
  - The script opens nothing. It requires `../api/normalize/firmware` only for the folder's path.
  - Install reads with `runCypher` and signs with the helpers' `regenerateJson` after `loadTAKey`, as Decision 6 says.
  - It finds the header by `firmware.conceptUuid(slug)` (Amendment 1.3).
- [x] No new dependency: `ajv` was already one, and only GF9 uses it.

Where the code decided something the ADR left open, or went past it:
- `fieldText` also strips trailing white space from every line (`graph-rules.js:48`), beyond Decision 3's dedent. That's harmless.
- `make()` counts every `.js` file but `index.js` as a rule file (`graph-rules.js:261`), while the loader only takes kebab-case names. A helper file there that isn't a rule would be reported as a rule with no entry. That fails loudly, so it's fine.
- The summary line (`install.js:326`) has no count for an element whose lookup failed. That element is logged and recorded in `errors`.
- The preamble says more than Decision 8 listed, as the story's Deviations record. It leaves out the eight labels' names, though (non-blocking 3).
- ADR 0041's Consequences bullet on hand edits (`:159`) contradicts its own Decision 6. The code follows Decision 6; BIBLE follows the bullet (blocking 1).

## Concept-graph integrity

- [x] Handles are in `kind:pubkey:slug` form: `39998:<TA>:graph-rule`, with each item at `39999:<TA>:<name>-<hash of the header's address>`.
- [x] A firmware reinstall is called out, in ADR 0041's Consequences ("Firmware reinstall required? Yes") and the story's Concepts touched. Each instance gets the concept at its first install after this ships.
- [x] Orientation: GL1 reads `/api/concept-graph/summaries`. Nothing else in the diff needs to orient.

## Things tests can't catch

- [x] **No secrets.** No added line holds a 64-hex string or the `82b75e47` literal, and the element-sync tests use made-up keys.
- [x] **No debug output.** The script's console lines are its CLI output, and install.js's new lines follow its existing logging.
- [x] **No commented-out code.**
- [x] **Error paths:**
  - A failed lookup is logged and recorded, and never falls through to create-element (check 1).
  - `--dry-run` skips the branch.
  - With no assistant pubkey, the lookup finds nothing and install behaves as before.
- [x] **Signing over another author's event isn't possible on this path.**
  - Install re-signs only an element whose address starts `39999:<TA>:` (`element-sync.js:46–47`), and an address carries its signer's pubkey (ES7, ES8, ES10; check 1).
  - An element of the assistant's that has no event behind it carries its would-be d, name and z tags (`_eventless.js`), so a re-sign keeps its address.
- [x] **Nothing is deleted.**
  - No node is deleted.
  - A re-sign replaces the item's tag nodes and, in the relay, its earlier event, as every re-sign does, Pass 2's schema saves included.
  - An item whose entry leaves the rulebook stays (Decision 6).
- [x] **Other concepts are unaffected.**
  - `synced` is `null` without `updateElements` (`install.js:255`), and the new module-level requires open nothing at load.
  - In check 1, the other concepts' 76 elements went to create-element exactly as before.
  - GF6 and GF7 keep the manifest's other entries and their order.
- [x] **Concurrency:** two installs at once could both re-sign or both create. Install has no lock, as the test plan records.
- [x] **Security:** the new Cypher takes parameters. Only firmware's relationship aliases are written into its text.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling. `graph-rules.js` is a generator ADR 0041 authorizes; it's run by hand and checked by a test.
- [x] The assistant's pubkey is read at runtime (`firmware.getTAPubkey()`) and written nowhere (GF11).
- [x] The four invariants:
  - POV-first and filtering at view time: which items count for a point of view is left to A10.31, at read time.
  - Decentralized-first: other authors' elements are neither gated nor signed over.
  - Local-first: the story makes one exception, approved at Planning. A reinstall overwrites an item edited in the graph, and BIBLE has to state that correctly (blocking 1).

## Product-guide adherence

This doesn't apply: the story traces to no PRD.

## Findings

### Blocking

1. **`BIBLE.md:407`** — The paragraph says each element "is re-signed in place, at the same address, when its file has changed, and left alone when it hasn't". That's wrong.
   - Install never sees whether a file changed. `planElement` compares the item's JSON in the graph with its file (`src/firmware/element-sync.js:56`; ADR 0041 Decision 6 and Amendment 1.2).
   - So an item edited in the graph gets re-signed back to its file by the next install, even though the file never changed. For example, an edit saved from the element page (`ui/src/pages/concepts/ElementDetail.jsx:164` → `POST /api/normalize/save-element-json`, signed as the assistant). The live check showed exactly this (install 2, `set-has-a-parent`).
   - This is the one place where this story lets a reinstall overwrite graph state. It's an exception to BIBLE §30 that the owner approved: "An item someone edits in the graph is put back by the next reinstall" (story, line 76). The rulebook's preamble (`docs/GRAPH_RULES.md:24`) describes it correctly. BIBLE, the spec later sessions reason from, says the opposite.

   **Asked change:**
   - In `BIBLE.md:407`, say that each element the assistant signed is re-signed in place whenever its JSON in the graph differs from its file, and left alone while they match. The difference can come from a change to the file, or from an edit made in the graph, which the install puts back.
   - Make the same correction in the manifest's changelog line, `firmware/versions/v1.0.0/manifest.json:623` ("when its file has changed").
   - Record the correction to ADR 0041, in an Amendment 2 or in the story's Deviations. It covers the Consequences bullet at `:159` ("An item whose file is unchanged keeps such an edit until its file next changes") and Option A's sentence at `:34`, which has the same wording.

### Non-blocking

1. **`src/firmware/graph-rules.js:78`, `:88`, `:93–94`** — Some format mistakes pass silently (check 2).
   - An entry whose heading doesn't start `## <n>.`, or that sits under another `## ` section, is dropped, and no problem is reported.
   - Any line after a field joins that field, indented or not. So a `---` separator, a stray note or a mistyped label ends up in the item's `source` or in another field.
   - The pull request's element-file diff would show changed text, which is ADR Option A's safeguard. But a missing item is easy to overlook.

   Optional improvement: report a problem for a non-blank line after a field that isn't indented. Do the same for a `## ` heading after the first entry that holds a name in backticks, and for a field line under a heading that isn't an entry's. Decision 3 defines the format, so this needs an ADR amendment and a follow-up row.
2. **`src/firmware/graph-rules.js:145`** — The first sentence ends at the first full stop followed by a space. So "e.g." or "i.e." in a Says' first sentence cuts `word.description` short (check 2). Optional improvement: don't end a sentence at those, or say in the rulebook's format paragraph that a Says' first sentence mustn't use them.
3. **`docs/GRAPH_RULES.md:22`** — "The eight labels above" points at a list that says what each field holds but doesn't give its label. The script matches the labels exactly (`graph-rules.js:27–36`), including "Refuses or reports" and "Enforced by". Optional improvement: list the eight labels as the script reads them.
4. **`test/firmware-element-sync.test.js:139–159`** — IS1–IS3 only check that names appear in install.js's text; IS3 passes if `conceptUuid(` appears anywhere in the file. Nothing in CI runs the new branch. So a regression that let `blocked` fall through to create-element, or let `unchanged` re-sign, would pass. Optional improvement: add a stack-free test that runs `pass1_bootstrap` with the driver and helpers stubbed, as `test/helpers/saveSchemaChild.js` does for Pass 2. Check 1 shows it takes about a hundred lines.
5. **An item's LMDB entry keeps the old words after a re-sign.**
   - Pass 3's `derive-all/ListItem` (`install.js:1262–1265`) builds each item's entry on top of the one already there (`src/lib/derivers/word.js:43–44`). So after a rule change, the json tag has the new words and the LMDB entry the old (check 3, `class-thread-acyclic`).
   - The node's JSON page shows both (`ui/src/pages/nodes/NodeJson.jsx:175`).
   - This was already true of every re-sign: Pass 2's schema saves, and the element page's save. This story makes rule changes go through it routinely.

   Optional improvement: add it to the story's Known limits. Have A10.31 read the json tag, as `relationship-type-allowed`'s `aliasOf` does (`:92`). And add this case to OPEN.md row 137, the LMDB doctrine row.
6. **`engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.md:109`** — AC6's UI page wasn't opened, by the Implementer or by me. `ConceptElements.jsx:67–72` lists elements with the same class-thread walk GL2 read live, so the risk is low. Optional improvement: open the page on the first instance that has a UI (staging), or have the owner accept the sub-check as covered.
7. **`BIBLE.md:379`, `:381`** — The other category lines were already out of date:
   - The manifest has seven graph-theoretic concepts; the line leaves out neo4j-property.
   - It has seven nostr concepts; the line leaves out nostr-user-tag, nostr-event-tag and tagging-with-specific-tag.
   - It has a five-concept `tag` category, which has no line.

   With the total now 41, the lines visibly don't add up. Optional improvement: correct them here, or file a docs row.
8. **Story line 122 (Known limits)** — create-element's lookup by name is tracked in `ledger/2026-10-02-normalize-lookups-by-concept-name.md`, whose grep finds `src/api/normalize/index.js:1790`, but the story doesn't point to it. Graph-rule is more exposed than most concepts. Once instances import one another's assistant-signed "graph rule" headers, a new entry's item can be filed under another instance's header; #80's "tag" bug came from the same pattern. Optional improvement: add the pointer, and note graph-rule's case in that row.

### Harness friction

1. The template's gate line can't be met on this Mac. This is already tracked: `ledger/2026-11-16-gate-status-unmet-without-local-gate.md`.
2. `scripts/scratch-stack.sh` mounts only `src/`. So both this story's live check and this review had to copy the firmware in and restart the control panel by hand. `ledger/2026-10-31-scratch-stack-image-and-lib-mount.md` covers the same gap for `lib/` and `test/`; `firmware/` is a third folder for that row.

## Verdict

**CHANGES_REQUESTED**

There is one blocking finding. BIBLE §7 (`BIBLE.md:407`), and the changelog line that goes with it, say an item is left alone while its file is unchanged. In fact install puts back an edit made in the graph. That's the one overwrite this story allows, and the spec states it backwards. The fix is a sentence or two of prose, with no code or test change.

Everything else holds:
- All six acceptance criteria have passing tests.
- The code follows ADR 0041 and its Amendment 1.
- Install's new path signs only the assistant's own elements, deletes nothing, and leaves every other concept's install as it was. I checked this with the dependencies stubbed, and live on a scratch instance.
- The eight non-blocking items are follow-ups.

### Close-out

- As this session was instructed, this review is written but not committed, and the story's Status stays Approved. Both are for the launching session.
- After the fix, the re-review should check BIBLE's and the changelog's new wording against `element-sync.js` and `install.js` as fresh claims.

---

## Round 2

**Date:** 2026-11-16
**Diff:** `git diff 8ae0a022..HEAD`, HEAD `f6394513`. It holds two commits and 13 files, +372 −20:
- `5994f9c5` (tests): ADR 0041 Amendment 2, GP12–GP15, and IS4–IS9 with their child process, `test/helpers/pass1bChild.js`, plus the test plan's update;
- `f6394513` (fixes).

`8ae0a022` is round 1's report. The owner chose to fix the blocking finding and non-blocking 1–5, 7 and 8, and to leave 6 (the UI page) for staging.

### Quality gates, round 2

Round 1's rules applied: no full gate, and nothing touched the `tapestry` container. Every run had `TAPESTRY_CONTAINER` unset, plus a dead conf through `BRAINSTORM_CONF_PATH`.
- [ ] **`npm test`** was not run, as in round 1. The full gate is the pull request's CI.
- [x] **The story's suites:**
  - `graph-rules-builder: 26 passed, 0 failed, 0 skipped`;
  - `graph-rule-firmware: 13 passed, 0 failed, 4 skipped`;
  - `firmware-element-sync: 20 passed, 0 failed, 0 skipped`.
- [x] **`node test/operations.test.js`:** `operations: 509 passed, 0 failed, 4 skipped`. This includes the five rules suites, which read the rulebook.
- [x] **`node src/firmware/graph-rules.js --check`:** exit 0, all six items current.
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)` before this section was added (see the close-out for after).
- [x] **What carries over from round 1:**
  - In `src/`, only `src/firmware/graph-rules.js` changed. install.js and element-sync.js are round 1's, so round 1's neighbouring runs and live check still apply.
  - No element file changed, so what an install puts in the graph is round 1's. For the same reason I booted no scratch instance this round.
  - GF13 is the only suite that pins BIBLE §7's text.

### Round 1's findings, as handled

| Round 1 | Now | How I checked |
|---|---|---|
| Blocking 1, BIBLE §7 | Fixed: BIBLE, the changelog, and the ADR's Option A and Consequences, corrected in place and recorded in Amendment 2.1 | Each new sentence re-derived from the code (next table) |
| 1, the parser's silent slips | Fixed (Amendment 2.2) | Probes below: each of round 1's slips is now a problem |
| 2, "e.g." ends a description | Fixed (Amendment 2.3) | GP15; probes below |
| 3, the labels weren't named | Fixed: the preamble lists all eight | Against `graph-rules.js:27–36`. The new list has wording slips (non-blocking 3 below) |
| 4, no test runs the branch | Fixed: IS4–IS9 | Mutation runs below; one gap (non-blocking 1 below) |
| 5, the LMDB entry | Recorded in the story's Known limits and OPEN.md row 137, with the pointer for A10.31 | Read |
| 6, the UI page | Left for staging by the owner, and recorded in Known limits | — |
| 7, BIBLE's category lines | Fixed | Each line checked against the manifest by script: every count and member matches, including the 11 concepts with no category |
| 8, the ledger pointer | Fixed: in the story and in the ledger row | Read. The row's grep still finds `src/api/normalize/index.js:1790` |

### The new wording, checked as fresh claims

| Where | Claim | Holds? |
|---|---|---|
| `BIBLE.md:408` | Each element the assistant signed is re-signed in place, at the same address, whenever its JSON in the graph differs from its file, and left alone while they match | Yes. `planElement` compares the stored JSON with the file's as values (`element-sync.js:56`). An update calls `regenerateJson(plan.uuid, data)` (`install.js:289`), which keeps the d tag. An unchanged element signs nothing (IS5). If two of the assistant's elements share a name, only the first by address is compared (Amendment 1.2); that's too rare to need saying in BIBLE. |
| same paragraph | They differ when the file has changed, and also when someone has edited the element in the graph: the install puts that edit back | Yes: round 1's live check, install 2, `set-has-a-parent` |
| same paragraph | Another author's element is never signed over, and no element is deleted | Yes: IS7, ES7 and ES8, and nothing on the path deletes |
| `manifest.json:623` | an install re-signs the instance's own element in place whenever its JSON in the graph differs from its file, so it also puts back an edit made in the graph | Yes |
| ADR 0041 `:34`, `:159`, and Amendment 2 | The corrected sentences, the format rules, where a sentence ends, and the stubbed test | Yes, against the code. The one exception: Amendment 2.2's "a name in backticks" is narrower than what the code refuses (non-blocking 3) |
| `docs/GRAPH_RULES.md:22–27` | The format list | The Labels, Refusals and Code bullets hold. The Headings and Fields bullets have slips (non-blocking 3) |
| `docs/GRAPH_RULES.md:29` | an install … puts back any edit made to one in the graph | Too broad: only the item's JSON is put back (non-blocking 3) |

### The parser's new rules

Neither today's rulebook nor a correctly written new entry fails:

| Input | Result |
|---|---|
| today's rulebook, with LF or with CRLF line endings | six items, no problem, the six descriptions unchanged |
| a proposed entry 7 | seven items, no problem |
| an entry 7 using every allowed shape: an empty bullet continued below it, nested bullets, a blank line and an indented paragraph inside a field, a tab-indented line, and an extra label | no problem; each field reads as written |
| an entry 7 with code, using a fixture rule file | no problem |
| "e.g. Dogs, i.e. Every kind" inside a Says' first sentence | the description is the whole first sentence |

Round 1's slips, and the edges of the new rules:

| Input | Result |
|---|---|
| a heading without the full stop, or `` ## Rule 7: `…` `` | the heading is a problem, and so is each of its field lines |
| entry 7 under `## Letter rules`, as `### 7.` | each of its field lines is a problem |
| `---` between entries; an unindented note; `- **Example**: …` | a problem naming the entry |
| a Says hard-wrapped onto an unindented line | a problem, since the documented format wants continuation lines indented |
| a `## Retired rules` section, with prose and plain bullets | no problem |
| `` ## How `rules check` reads this file `` | a problem: anything in backticks makes a heading that isn't an entry's a problem (non-blocking 3) |
| a field line given as an example, in a fenced block in the preamble | a problem, since fenced blocks aren't recognized. That fails loudly, and today's preamble has none |
| a Says whose second sentence starts with a code span | the description runs on into the second sentence ("Every set has a name. rules check reports one without."). This follows Amendment 2.3's capital-letter rule, and GP15's fourth case pins it |

### Do the new tests catch what they claim?

Each regression was applied on its own to a copy of HEAD, made with `git archive` in the scratchpad. Nothing in the repo changed.

| Regression | Tests that fail |
|---|---|
| none (the baseline) | none: 20 of 20 pass |
| M1: a `blocked` element falls through to create-element | IS4, IS7 |
| M2: an `unchanged` element is re-signed | IS5, IS6 |
| M3: a failed lookup falls through to create-element | IS4, IS8 |
| M4: the lookup gets the concept's name instead of its header's address | IS3, IS9 |
| M5: every concept takes the `updateElements` path | IS8, IS9 |
| M6: an update signs nothing | IS2, IS6 |
| M7: an update re-signs the first row found instead of the planned address | **none** |
| M8: the JSON is compared as text, not as values | ES3, ES5, ES8, IS5, IS6 |
| M9: an element only another author has is re-signed | ES7, ES10, IS6, IS7 |
| M10: the branch runs during a dry run (no test claims to catch this) | none |
| graph-rules.js as it was at round 1 | GP12, GP13, GP14, GP15 |
| each of the four parser changes undone on its own | GP12, GP13, GP14 and GP15 respectively; removing the abbreviation skip alone fails GP15 |

Every regression a test claims to catch fails that test. M7 isn't claimed by any test, but it's the gap that matters (non-blocking 1).

### Findings, round 2

#### Blocking
None.

#### Non-blocking
1. **`test/firmware-element-sync.test.js:177–184`, `test/helpers/pass1bChild.js:59–66`** — No scenario puts another author's element beside a changed element of the assistant's, so M7 passes all twenty tests.
   - With another author's element listed first, M7 would re-sign that author's event under the assistant's key. That's the property Decision 6 and BIBLE state.
   - ES8 pins which element `planElement` chooses, but not whether install uses that choice.

   Optional improvement: add a case that lists another author's element first and the assistant's, holding other JSON, second, and use it for `field-mark-allowed`. In the scratch copy, the correct code still passes 20 of 20 with that case, and M7 fails IS6.
2. **`test/firmware-element-sync.test.js:193`, and its comment at `:173`** — The child's `NEO4J_URI` is never read.
   - The driver reads its address only from the conf file (`src/utils/config.js:19`). So if the stub were ever bypassed, the driver would connect to `bolt://localhost:7687`. On this Mac, that's the agent-memory instance's published port. I checked that the config reader resolves that address under the child's environment, without connecting.
   - Today the stub covers every path: Pass 1 has no lazy requires, and none of the modules that load the npm driver directly are in its require graph.
   - My runs were safe because they inherited my own dead conf; a plain run of the suite wouldn't have it.

   Optional improvement: give the child a dead conf through `BRAINSTORM_CONF_PATH`, as `test/schema-save-finds-the-right-header.test.js:216–219` does, and correct the comment. Ledger `2026-11-14-harness-points-tests-at-agent-memory` covers this class of hazard.
3. **`docs/GRAPH_RULES.md:23`, `:24`, `:29`** — Three wording slips in the new preamble:
   - Line 23 says another level-2 heading "doesn't name a rule in backticks", but the code refuses anything in backticks there (`graph-rules.js:81–82`). Amendment 2.2 and the story's Deviations also say "a name". Either say "has nothing in backticks", or check the backticked text against `KEBAB`. A mis-headed entry's field lines are caught either way (see the probes).
   - Line 24 says a field "starts with its label in bold, then a colon". That reads as `**Says**:`, which is exactly the form the parser refuses. Say "its label and a colon, both in bold".
   - Line 29 says an install "puts back any edit made to one in the graph". It puts back the item's JSON only. `regenerateJson` keeps every other tag, and the import keeps the node's relationships and other properties; in round 1's live check, each re-signed item kept its `HAS_ELEMENT`. Say "any change made to one's JSON in the graph".
4. **`src/firmware/install.js:271`** — Nothing checks that a dry run stays out of the new branch (M10). Optional improvement: a dry-run case in the child that expects no lookups and nothing signed.

### Verdict, round 2

**PASS**

The blocking finding is resolved:
- BIBLE §7, the manifest's changelog and ADR 0041 now say what install does: it compares an item's JSON in the graph with its file, re-signs it while they differ, and so puts back an edit made in the graph.
- I re-derived each sentence from `element-sync.js` and `install.js`, and round 1's live check showed the behaviour.

The other fixes hold:
- Every slip from round 1 is now a problem.
- No correctly written entry fails, and today's rulebook makes the same six items as before.
- GP12–GP15 and IS4–IS9 each fail on every regression they claim to catch.

The four non-blocking items are worth doing, and none of them stops the merge:
- the first two strengthen the tests' protection (against signing over another author's element, and against reaching the agent-memory instance);
- the third is three small wording fixes;
- the fourth is optional.

### Close-out, round 2

- **The story's Status** is the coordinator's to flip, in the review commit. With this section added, harness-lint's L1 check reads this review as passed, and it flags the story's `Approved` status until the flip.
- **Completion detection** goes to the coordinator, not into this file.
- **Re-checks:** if the non-blocking wording is changed, the next reader should check the new sentences against `graph-rules.js` and `install.js` as fresh claims, as this round did.

---

## Round 3

**Date:** 2026-11-16
**Diff:** `git diff 47a9462d..HEAD`, HEAD `a3ebb0a5`. It holds two commits and three files, +37 −12:
- `e8b00534` (tests): IS10 with its `other-first+own-changed` case, and a dead conf for the child;
- `a3ebb0a5` (docs): three preamble sentences.

`47a9462d` is round 2's report, along with the story's flip to Done. The owner chose to fix round 2's non-blocking 1–3, and to leave 4 (the dry-run check) as a follow-up.

### What I checked

- [x] **Nothing else changed.** The only files are `docs/GRAPH_RULES.md` (three preamble lines), `test/firmware-element-sync.test.js` and `test/helpers/pass1bChild.js`. No source, firmware, BIBLE, ADR or story file changed, and `node src/firmware/graph-rules.js --check` still exits 0.
- [x] **The suites the diff touches,** each run on its own, with `TAPESTRY_CONTAINER` unset and a dead conf:
  - `firmware-element-sync: 21 passed, 0 failed, 0 skipped`;
  - `graph-rules-builder: 26 passed, 0 failed, 0 skipped`;
  - `graph-rule-firmware: 13 passed, 0 failed, 4 skipped`;
  - the five rules suites, which read the rulebook: 10, 5, 10, 14 and 12 passed, none failed.
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)`. The story is Done.

| Round 2 | Closed? | Evidence |
|---|---|---|
| 1, M7 passes every test | Yes | In a scratch copy of HEAD, M7 (re-sign the first row found) fails IS10 alone, and so does a variant that re-signs every row found. Every other round-2 regression still fails its tests, and M10, left as a follow-up, still passes them all. |
| 2, the child's Neo4j fallback | Yes | In the copy, the child reported what the real config reader resolves, without connecting. The parent ran without my own dead conf, so only the test's own protected it. The child resolved `bolt://127.0.0.1:9` from the test's own `pass1b-dead-<pid>.conf`, which existed during the run. No such file is left in the temp folder afterwards. |
| 3, three preamble slips | Yes, in the rulebook | Line 23, "has nothing in backticks", matches `graph-rules.js:81–82`. Line 24, "its label and a colon, both in bold", matches `FIELD_LINE`. Line 29 now says an install "puts back an item's JSON when someone has edited it in the graph", which is what `planElement` and `regenerateJson` do. |

### Findings, round 3

#### Blocking
None.

#### Non-blocking
1. **Two records still describe the heading rule as narrower than it is.** ADR 0041 Amendment 2.2 says "holds a name in backticks", and the story's Deviations say a heading that "names a rule in backticks". The code and the rulebook refuse anything in backticks. Round 2's finding 3 mentioned both. Optional improvement: align them, or let them stand as the record of what round 1 changed.
2. **IS10 isn't in the test plan.** The plan's AC5 row, and the story's Deviations, name IS4 to IS9 only. Optional improvement: add IS10 to that row.

### Verdict, round 3

**PASS**

Round 2's non-blocking 1–3 are closed, and nothing else changed:
- IS10 catches a re-sign that lands on another author's element.
- The child can no longer fall back to the agent-memory instance's Neo4j, and its conf file is removed after the run.
- The preamble's three sentences match the code.

The two items above are record-keeping and don't stop the merge.

### Close-out, round 3

- **Story Status:** the story is already Done (`47a9462d`), and lint stays clean with this section added.
- **Completion detection** goes to the coordinator, not into this file.
