# Review: doc lane — CONFIGURATION.md's IS_A_PROPERTY_OF and ENUMERATES rows, which way each relationship points

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-18
**Diff:** `git diff` (uncommitted, unstaged) on `docs/configuration-relationship-directions`, over `d5deea223` (GitHub `staging`, the merge of PR #155). One file, `docs/CONFIGURATION.md` (+2 −2): lines 141 and 143 of § "Relationship Type UUIDs (`relationshipTypeUUIDs`)".
**Lane:** doc lane, a one-liner (`engineering-team/workflows/0-intake.md` step 3: `:27`, `:31`, `:39`). Implementer, then Reviewer. A non-numbered review, with no story, no test plan and no book. This file is the lane's record. Template: the docs-mode variant of `templates/review-checklist.md` (`:20`).
**Spec:** the brief's why. An agent used today's old routes and wired a new property to both its concept's primary property and its JSON Schema node. The owner says the edge to the JSON Schema is wrong, and this doc still described that old convention. Checked against BIBLE §6, ADRs graph-operations-first-slice/0018 and 0016, `src/operations/catalog/graph/_properties.js`, every ENUMERATES writer and reader, and the active firmware's relationship-type definitions.
**Filed under:** graph-operations-first-slice. The property writes (story 18, ADR 0018) belong to this epic, and their `tangled-tree` refusal is how the mis-wiring shows up.

## Quality gates (run by reviewer, not trusted)

- [x] `git diff --check`: no output, exit 0. `git diff --stat`: one file, 2 insertions, 2 deletions.
- [x] **No suite reads the changed section.** `grep -rln 'relationshipTypeUUIDs\|Relationship Type UUIDs' test/` finds nothing. Five suites read `docs/CONFIGURATION.md`: `negentropy-sync-presets`, `scheduled-search-and-house-scores-refresh`, `treasure-maps-router-preset`, `router-config-reload-in-place` and `strfry-router-saved-state`. None of them names the table's heading or any of its keys. No test can change outcome on this diff, so none was run.
- [ ] `npm test`: **not run, on purpose.** On this Mac the full suite leaks tag fixtures to a public relay (open row `2026-09-30-npm-test-step-leaks-fixtures`), and the brief rules out Docker and `localhost:7778`. `node test/gate-status.js` prints `no gate run records in <worktree>/tmp/gate-runs` and exits 2, so there is no gate line to quote. In docs-mode, `npm test` is only a regression check. CI's `Test / stack-free` job runs it on the pull request.
- [x] `bash scripts/harness-lint.sh`, before this file was written: last line `harness-lint: clean (0 violations)`, exit 0. With this file in place: the same last line, exit 0. Its one line about this file is an INFO line (friction 2).
- [ ] Playwright: not applicable (no UI change).
- [ ] _Lint / typecheck / build not configured: skipped._
- [ ] Independent checker (`workflows/5-review.md`, "Optional: an independent check before the commit"): not applied, because this session can't start one. The session that commits this review can run one first.
- **Sources.** I read concept definitions from the repo's firmware (`firmware/active` → `versions/v1.0.0`), which holds the files a firmware install publishes. I did not use the Concept Graph API on `:7778`, which the brief puts off limits. No live graph was read, so this review claims no edge counts for any instance.

## Claims adherence (doc-lane variant)

| # | Claim | Source checked | Holds? |
|---|---|---|---|
| 1 | IS_A_PROPERTY_OF: a top-level property → its concept's Primary Property | BIBLE §6 `:259`, `:265`. ADR 0018 `:24`, `:181`. `_properties.js:485-487`: the tree is every `Property` with an IS_A_PROPERTY_OF path into the primary property. `:576-577`: a node's parent is its one IS_A_PROPERTY_OF target. `generate-property-tree` roots the tree at the primary property when the concept has one (`src/api/normalize/index.js:3800-3821`). The New Property form defaults to it (`ui/src/pages/concepts/NewProperty.jsx:60`). Test AP8 asserts it (`test/operations/graph/add-property.test.js:304`) | Yes |
| 2 | IS_A_PROPERTY_OF: a nested property → its parent Property | BIBLE §6 `:259`, `:266`. ADR 0018 `:181`. `_properties.js:576-577`. `generate-property-tree` `:3789-3791`. AP8 `:305` (`city` under `address`) | Yes |
| 3 | Those are its only ends. The row replaces "Property → JSONSchema", so it now says no IS_A_PROPERTY_OF ends at a JSON Schema | BIBLE §6 `:264` ("**JSON Schema** ← Primary Property ← top-level properties ← nested properties"). ADR 0016 `:74` ("`PROPERTY_MEMBERSHIP` (primary property to schema)"). ADR 0018 `:24` ("Each link is `IS_A_PROPERTY_OF`") and `:141`. Graph create-concept wires the edge (`src/operations/catalog/graph/_concepts.js:380`) and lists it in the property tree graph (`:283`). Today's create-concept (`src/api/normalize/index.js:1700`) and skeleton (`:507-525`) wire it too | No: each concept's primary property has one (B1) |
| 4 | ENUMERATES starts at a Superset | BIBLE §6 `:260`. Both writers start at the enumerating concept's superset: firmware install (`src/firmware/install.js:757-762`, `:795-800`) and `POST /api/normalize/enumerate` (`src/api/normalize/index.js:4137-4148`, `:4204-4207`). `ui/src/pages/reading/readVerbs.js:394` and `:843` read it that way, and `ui/src/pages/settings/FirmwareExplorer.jsx:942` draws it that way. Two sources disagree. The firmware definition says Concept Header → Property, as the old row did (`firmware/active/concepts/relationship-type/elements/property-enumeration.json:14-15`). The audit's wiring rule says ListHeader → Property (`src/api/audit/index.js:141`, `:359`, `:783`) | Yes (N3 for the two that disagree) |
| 5 | ENUMERATES ends at a Property | BIBLE §6 `:260`. The enumerate route (`nodeTo` at `:4198`, the edge at `:4204-4207`). The firmware definition (`:16`). readVerbs `:394`. Against it: firmware install wires each of the manifest's five enumerations (`firmware/active/manifest.json:401`) to the *target concept's JSONSchema node*, and names the field in the edge's `destinationPath` (`install.js:743`, `:775-800`). `apply-enumerations` is the reader that puts enumerated values into a schema, and it reads only edges that end at a JSONSchema (`src/api/normalize/index.js:5978-5981`) | Yes against the spec and the enumerate route. Firmware install's edges end at the JSON Schema instead (N1) |
| 6 | "(horizontal integration)" | BIBLE §6 `:260`, glossary `:1687` | Yes. The row drops BIBLE's ", explicit event", and that is right for this doc: firmware install's edges have no event (`install.js:795-800` writes only to Neo4j) |
| 7 | The two rows now say what BIBLE §6's Property Relationships table says | BIBLE §6 `:259` (word for word), `:260` (apart from ", explicit event") | Yes |
| 8 | The why: the old row was the convention, and the new property writes refuse a property wired to both its primary property and its JSON Schema | The old row (`git diff`). `_properties.js:488-491`: a node's parents are all its IS_A_PROPERTY_OF targets, the schema node included. `:576`: a node with any number of parents other than one is tangled. `:82` and `:655-658`: refused `tangled-tree`, 409. ADR 0018 `:187` and `:209`. ADR 0018 `:26`: a node that hangs off the schema node alone "doesn't count" | Yes. The record doesn't say how the agent's node got both edges. Two old routes can do it (N2) |

## ADR adherence

Not applicable as such, because the lane has no ADR. ADRs 0016 and 0018 are used as sources (claims 1–3 and 8). The diff adds no dependency, no code and no layering.

## Concept-graph integrity

- [x] No concept definition or handle is touched, so this diff needs no firmware reinstall.
- [ ] The firmware's two relationship-type definitions still give the old directions (N2, N3). Changing them is a concept-definition change and needs a firmware reinstall (AGENTS.md §6), which is outside this lane.
- [x] No new code, so nothing has to orient via `/summaries`.

## Things tests can't catch

- [x] No secrets, no debug output, no commented-out content.
- [x] Scope: the two rows only. The table's other four rows are unchanged (N4).
- [ ] **Invariant 4 (BIBLE §30).** This is B1's hazard. A reader who takes the new row as complete will see each concept's primary-property → JSON-schema edge as a stray. On a concept made by graph create-concept, no event stands behind that edge (`_concepts.js:376-385`, ADR 0016). Taking it out loses graph state that no relay can give back. Every reader that finds a concept's properties from its schema reaches them through that edge (B1).

## House rules check

- [x] Concept Graph API authority: the rows claim nothing beyond what firmware and code define. The API itself was not consulted (see Sources).
- [x] No new lint, typecheck or build tooling.
- [x] No TA pubkey literal is added.

## Product-guide adherence

Not applicable: no PRD-traced copy.

## Findings

### Blocking

1. **`docs/CONFIGURATION.md:141` — the IS_A_PROPERTY_OF row leaves out the relationship's root link: the primary property's own IS_A_PROPERTY_OF goes to the JSON Schema.**
   - The row's two cases are right (claims 1 and 2). But it replaces "Property → JSONSchema" outright, so it now says no IS_A_PROPERTY_OF ends at a JSON Schema (claim 3). Every concept has one that does. BIBLE §6 `:264`, ADR 0016 `:74` and ADR 0018 `:24` and `:141` all name it. Graph create-concept writes it (`src/operations/catalog/graph/_concepts.js:380`), and so do both of today's concept routes (`src/api/normalize/index.js:507-525`, `:1700`).
   - **It is load-bearing.** Every reader that finds a concept's properties from its JSON schema reaches them through this edge:
     - the Properties tab (`ui/src/pages/concepts/ConceptProperties.jsx:23`), whose query AP8 tests through `test/helpers/propertyGraph.js:336-348`;
     - the tree view (`ui/src/pages/concepts/PropertyTreeView.jsx:50`);
     - the New Property form's parent list (`NewProperty.jsx:43`);
     - Tree → Schema (`src/api/property/index.js:38`);
     - the reading pages (`readVerbs.js:395`, `:783`, `:844`).
   - **The risk is the one this change sets out to remove, pointed the other way.** An agent that takes the row as complete will read the primary property's edge as the mistake the owner named. On a concept made by graph create-concept, taking that edge out loses graph state that no relay holds (BIBLE §30).
   - BIBLE §6's own row (`:259`) has the same gap. BIBLE covers it five lines down (`:264`), and this doc has no such line.
   - **Asked change:** name the root link in the row. Here is one wording; each of its three parts is backed by the sources for claims 1, 2 and 3: `Property → Primary Property (top-level) or Property → Property (nested); the Primary Property's own edge goes to the JSONSchema`. Optionally, add BIBLE §6 `:265`'s rule that no other property's edge does. If the owner's ruling is meant to cover the primary property's edge too, that changes BIBLE §6, ADRs 0016 and 0018 and every create-concept path, and it needs its own ruling before this row can say so.

### Non-blocking

1. **ENUMERATES has two shapes in the code. The row follows BIBLE §6 `:260` and describes one of them.** No change to the row is asked; this calls for a ledger row.
   - `POST /api/normalize/enumerate` writes Superset → Property, with a signed relationship event (`src/api/normalize/index.js:4190-4207`). `readVerbs.js:394` and `:843` read only that shape.
   - Firmware install writes each manifest enumeration as Superset → the target concept's JSONSchema node, with the field in `destinationPath` and no event (`src/firmware/install.js:743`, `:795-800`). `apply-enumerations` puts the values into the schema, and it reads only that shape (`src/api/normalize/index.js:5978-5981`).
   - So no edge the enumerate route writes is ever applied to a schema, and the reading pages can't see the edges firmware install writes. BIBLE names only the first shape. Which one stands is the owner's call. Until then the row agrees with the spec, and that is all this lane can ask of it.
   - **Suggested:** an OPEN.md row that names `graph enumerate` (ADR 0018 `:354`, `:428`) as the operation that will have to pick one. Optional, if the author wants the doc to describe what an install holds today: add "(firmware install's own edges go Superset → JSONSchema, the field named in the edge's `destinationPath`)". `install.js:743` and `:795-800` support that claim.
2. **Code that still reads or writes IS_A_PROPERTY_OF the old way (report only, as the brief asks).**
   - **Writers that hang a top-level property on the JSON Schema:**
     - `create-property` without `parentUuid` (`src/api/normalize/index.js:3478-3505`, `:3551-3555`);
     - `enumerate`, which adds the edge even to a property already under the primary property, checking only for a direct edge (`:4209-4243`);
     - `generate-property-tree`, when the concept has no primary property (`:3800-3802`).
   - **`create-property`'s d-tag hashes the `property` concept's address, not the parent's** (`:3532`), and its duplicate check looks only under the call's own target (`:3508-3516`). So one name used under two parents, or under two concepts, becomes one node with two parents. That is one way to reach claim 8's state.
   - **Counts that take one hop to the JSON Schema as the concept's properties:** `ConceptOverview.jsx:18` and `:22` (shown at `:81`), and `ConceptList.jsx:28` and `:41` (the "Properties (count)" column, `:289`). On a tree in BIBLE's shape that count is always 1, the primary property, however many fields the concept has.
   - **`ConceptProperties.jsx:27`, `:38`** shows "(top level)" only for a JSON-schema parent. So the primary property shows as the only top-level row, and each real top-level field shows the primary property as its parent. AP8 accepts that (`add-property.test.js:304`).
   - **The audit's wiring rule** (`src/api/audit/index.js:138`, `:357`, `:781`) accepts Property → JSONSchema from any property. So it never flags the edge the owner called wrong, or the two-parent node that graph add-property refuses as `tangled-tree`.
   - **`readVerbs.js:395`, `:783`, `:844`** follow `IS_A_PROPERTY_OF*1..3` to the JSON Schema. In BIBLE's shape each field is one hop further from the schema than in the old one, so the cap now reaches two levels of fields where it used to reach three.
   - **The firmware's `property-membership.json:16`** says `nodeToType: "jsonSchema"`. Its descriptions (`:6`, `:14`) say "a JSON Schema or parent Property", which fits BIBLE if the JSON Schema is read as the primary property's end. No code reads `nodeFromType` or `nodeToType`.
   - **Docs:** `docs/ARCHITECTURE.md:69` and `:71` still carry both old rows word for word, in its "Key relationship types" table. `docs/CANONICAL_CONCEPT_AUDIT.md:13`, a dated record (2026-03-02), uses the old convention too.
   - **Suggested:** a follow-up doc-lane change for ARCHITECTURE.md, which an agent is as likely to read as this file, and one OPEN.md row for the code.
3. **The firmware's ENUMERATES definition says Concept Header → Property** (`property-enumeration.json:14-15`), which no writer does. The audit expects ListHeader → Property (`src/api/audit/index.js:141`, `:359`, `:783`). That flags every edge both writers make, because a superset is a ListItem (`_concepts.js:362`). The old row matched the firmware definition. Changing the definition is a concept change and needs a firmware reinstall (AGENTS.md §6). **Suggested:** fold this into N1's ledger row.
4. **The table's other rows, against BIBLE §6 (report only).**
   - **These two leave sets out of the class thread, and that matters:**
     - `CLASS_THREAD_PROPAGATION | Superset → Superset` (`:139`). BIBLE `:243` says Superset → Superset/Set, and so does firmware (`class-thread-propagation.json:14`, "Connects a Superset or Set to a child Set"). Sets are made under supersets and under other sets (`src/operations/catalog/graph/_sets.js:6`).
     - `CLASS_THREAD_TERMINATION | Superset → Element` (`:140`). BIBLE `:244` and firmware (`class-thread-termination.json:14`) say Superset/Set → Element. add-to-concept can anchor a member in a set (`_memberships.js:229-230`).
   - **These two don't matter:** `CLASS_THREAD_INITIATION | ListHeader → Superset` (`:138`) and `IS_THE_JSON_SCHEMA_FOR | JSONSchema → ListHeader` (`:142`). BIBLE says ConceptHeader (`:242`, `:249`), but every concept header node carries both labels (`_concepts.js:367`).
   - **Context:** nothing at run time reads these keys' UUIDs. Only the settings page (`ui/src/pages/settings/UuidSettings.jsx`) and the restart check (`src/api/settings/settingsApi.js:198`) touch them, and `src/config/defaults.json` has none. So the table's directions are documentation only, which is why they need to be right.
5. **Outside the diff: stale "BIBLE §9" cross-references for the property tree.**
   - ADR 0018 cites BIBLE §9 for the tree's layout (`:24`, `:332`), for the property d-tag rule (`:47`, `:172`) and as the section to edit (`:388`). `_properties.js:6`, `:78` and `:775` follow it.
   - The layout and the d-tag rule are in BIBLE §6: "Property Tree Structure" (`:262-268`) and "Deterministic D-Tags for Properties" (`:270-274`). That is where story 18's BIBLE edits landed (`:268`, `:281`).
   - §9 is "Core Nodes of a Concept", and it already was at the ADR's first commit (`3657090d9`). **Suggested:** correct them the next time ADR 0018 or `_properties.js` is touched.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. The step "run `npm test`" can't be followed on this Mac. The open row `2026-09-30-npm-test-step-leaks-fixtures` already covers this. No new row.
2. `scripts/harness-lint.sh:111` says this review "predates the numbering convention". It is a doc-lane review, and 0-intake step 3 (`:31`) gives doc-lane reviews exactly this non-numbered form. The open row `2026-11-16-lint-mislabels-doc-lane-reviews` already covers this. No new row.

## Close-out

- [x] No story to mark Done: the doc lane has none (0-intake step 3).
- [x] Completion detection: none needed, because a doc-lane one-liner opens no book (0-intake `:39`).
- [ ] Commit: left to the session that launched this review, which asked the Reviewer not to commit. The role's rule is to commit the review whatever the verdict. A suggested message: `review: configuration-relationship-directions — CHANGES_REQUESTED (graph-operations-first-slice, doc lane)`.

## Verdict

One blocking item, B1. The IS_A_PROPERTY_OF row is right about top-level and nested properties. But it drops the primary property's own edge to the JSON Schema, which BIBLE §6, ADRs 0016 and 0018 and every create-concept path keep, and which every property page reads through. The ENUMERATES row holds against BIBLE §6 `:260` and the enumerate route. The code's second shape for it, firmware install's edge to the JSON Schema, existed before this diff and belongs in a ledger row, not in this row (N1).

**CHANGES_REQUESTED**

## Round 2 — 2026-11-18 local, 2026-11-19 UTC (still uncommitted, over `d5deea223`)

The coordinator applied round 1's findings and asked for a review of the whole change again. Nothing is committed. This round adds:
- **`docs/CONFIGURATION.md`** (now +4 −4):
  - the IS_A_PROPERTY_OF row (`:141`), in round 1's suggested wording (B1);
  - the CLASS_THREAD_PROPAGATION row (`:139`) and the CLASS_THREAD_TERMINATION row (`:140`), changed after round-1 N4.
  - The ENUMERATES row (`:143`) is unchanged.
- **`docs/ARCHITECTURE.md:69`, `:71`** (+2 −2): the two old rows round-1 N2 found, now worded as in CONFIGURATION.md.
- **Two new, untracked ledger rows** for round 1's reported findings: `ledger/2026-11-18-old-routes-hang-properties-on-the-schema.md` and `ledger/2026-11-18-enumerates-has-two-shapes.md`.

I checked each changed row and each ledger claim afresh against the sources, including round 1's own suggested wording (role rule 10). I did not rely on the coordinator's summary.

### Gates (run by the reviewer)

- [x] `git diff --check`: no output, exit 0.
- [x] **No suite reads a changed line.**
  - No test names `docs/ARCHITECTURE.md`. None reads CONFIGURATION.md's relationship table (round 1).
  - The suites that read `ledger/` test the ledger's mechanics on fixtures (`test/ledger-row-ids.test.js:1-15`). L15, below, checks the real rows' format.
- [ ] `npm test`: not run, for round 1's reasons.
- [ ] **`bash scripts/harness-lint.sh` fails.**
  - Before this section was written: `VIOLATION L15 ledger/2026-11-18-old-routes-hang-properties-on-the-schema.md — the filename is not a YYYY-MM-DD-<slug> id (the UTC date, then two to six lowercase words joined by hyphens)`, then `harness-lint: 1 violation(s)`, exit 1.
  - With this section in place: the same one violation and the same last line, `harness-lint: 1 violation(s)`, exit 1. This review adds no violation; its one line about this file is the INFO line (friction 2).
- [x] **Compared by script:**
  - The two docs' IS_A_PROPERTY_OF rows are the same string, and so are their ENUMERATES rows.
  - The PROPAGATION and TERMINATION rows are BIBLE §6 `:243` and `:244` word for word.

### Round-1 findings, re-checked

- **B1 (IS_A_PROPERTY_OF's root link): fixed.** The row now names the primary property's own edge to the JSON Schema (R2 claims 1–3).
- **N1 (ENUMERATES's two shapes): recorded** in the ENUMERATES ledger row. One of that row's claims doesn't hold (R2-B5).
- **N2 (code still on the old convention): recorded** in the old-routes ledger row, and ARCHITECTURE.md's two rows are fixed. One claim in the row has no source (R2-B4).
- **N3 (firmware's ENUMERATES definition and the audit): half recorded.** The row has the firmware definition, but it leaves the audit out. It also turns "no code reads the definition's `nodeFromType`/`nodeToType`" into "no code reads" the shape (R2-B5).
- **N4 (the table's other rows): TERMINATION is fixed; PROPAGATION is not right yet** (R2-B3). Its wording follows my round-1 note, which pointed at BIBLE §6 `:243` and wrongly said firmware matched it (Corrections, below).
- **N5 (stale "BIBLE §9" cross-references):** outside this diff, and still open.

### Changed rows

| # | Row | Claim | Source checked | Holds? |
|---|---|---|---|---|
| 1 | CONFIGURATION.md `:141`, IS_A_PROPERTY_OF | "Property → Primary Property (top-level)" | Round-1 claim 1's sources | Yes |
| 2 | Same | "or Property → Property (nested)" | Round-1 claim 2's sources | Yes |
| 3 | Same | "; the Primary Property's own edge goes to the JSONSchema" (round 1's wording, checked afresh) | BIBLE §6 `:264`. ADR 0016 `:74`. ADR 0018 `:24`, `:141`. `_concepts.js:380`, `:283`. `src/api/normalize/index.js:507-525`, `:1700`. With this part, the row names all three links of BIBLE §6 `:264-266` | Yes. Round-1 B1 is fixed |
| 4 | CONFIGURATION.md `:139`, CLASS_THREAD_PROPAGATION | "Superset → Superset/Set" | BIBLE §6 `:243`, word for word. But a set's parent can also be a set. BIBLE §11 makes a set "under a Superset or Set" (`:487` add-subset, `:493` create-set). link-set puts "a set or a concept's superset" under "a superset or a set" (ADR 0028 `:11`, `:65`; `_sets.js:63-64`). Firmware says "Connects a Superset or Set to a child Set" (`class-thread-propagation.json:14`). The audit's rule is Superset/Set → Superset/Set (`src/api/audit/index.js:137`) | No: a Set as the parent is missing (R2-B3) |
| 5 | CONFIGURATION.md `:140`, CLASS_THREAD_TERMINATION | "Superset/Set → Element" | BIBLE §6 `:244`, word for word. Firmware `class-thread-termination.json:14`. A member can be anchored in a set (`_memberships.js:229-230`) | Yes |
| 6 | CONFIGURATION.md `:143`, ENUMERATES | Unchanged since round 1 | `git diff` shows round 1's line. Round-1 claims 4–7 | Yes (round-1 N1 still stands for the code) |
| 7 | ARCHITECTURE.md `:69`, IS_A_PROPERTY_OF | The same text as CONFIGURATION.md `:141` | Compared by script: equal | Yes (rows 1–3) |
| 8 | ARCHITECTURE.md `:71`, ENUMERATES | The same text as CONFIGURATION.md `:143` | Compared by script: equal | Yes (round-1 claims 4–7) |

### Ledger row `2026-11-18-old-routes-hang-properties-on-the-schema`

| # | Claim (line) | Source checked | Holds? |
|---|---|---|---|
| A1 | The header fields and sections (`:1-7`, `:9`, `:14`, `:16`) follow the template and the other rows | `templates/open-row.md`. `ledger/2026-11-18-unlink-set-skips-last-concept-guard.md`. Type's and Status's first words are `bug` and `OPEN` | Yes, apart from the id (A2, A3) |
| A2 | The id `2026-11-18-old-routes-hang-properties-on-the-schema` | OPEN.md `:20` allows two to six slug words. This one has seven. L15 fails on it (Gates) | No (R2-B1) |
| A3 | The id's date, and `**Opened:** 2026-11-18` (`:3`, `:5`) | OPEN.md `:20`: "the UTC day the row is minted (`date -u +%F`)". The file was created at 00:44:59Z on 2026-11-19 (its `stat` birth time) | No (R2-B2) |
| A4 | `:9`: "An agent using today's routes to give a concept a property enumerated by another concept's superset ended up with a property node that hangs under both…" | Round 1's brief describes the incident without the enumerate step. Round-1 claim 8: the record doesn't say how the node got both edges | The review didn't find this, and the row gives no source (R2-B4) |
| A5 | `:9`: BIBLE §6 puts a top-level property under the primary property and a nested one under its parent, and only the primary property's own edge goes to the JSON Schema | BIBLE §6 `:259`, `:264-266` | Yes |
| A6 | `:9`: the new property writes refuse such a concept (`tangled-tree`), so its properties can't be changed through them until the extra edge goes | `_properties.js:576`, `:655-658`. All four writes go through the shared `load` (one call each in `add-property.js`, `update-property.js`, `remove-property.js` and `set-schema.js`). Each suite tests `r-tangled` → 409 (`add-property.test.js:332`, `update-property.test.js:237`, `remove-property.test.js:182`, `set-schema.test.js:261`) | Yes |
| A7 | `:10`: the three writers and their lines | `src/api/normalize/index.js:3478-3505` (create-property's target lookup; it writes the edge at `:3551-3555`). `:4209-4243`. `:3800-3802` | Yes |
| A8 | `:10`: create-property makes the address from the property concept, "so one name used under two parents becomes one node with two parents: another way to a `tangled-tree` refusal" | `:3532`, `:3508-3516`, `:3552-3555`. A node whose two parents are both JSON schema nodes is in no tree and is never refused. So this is "a way to" a refusal, not always one | Yes |
| A9 | `:11`: the readers and what each does | Round-1 N2: `ConceptOverview.jsx:18`, `ConceptList.jsx:28`, `ConceptProperties.jsx:27`, `src/api/audit/index.js:138`, `readVerbs.js:395`, `:783`, `:844` | Yes. The row names them without their files (R2-N2) |
| A10 | `:12`: firmware's `property-membership.json` says `nodeToType: "jsonSchema"`, no code reads it, and changing it needs a reinstall | `property-membership.json:16`. No `nodeFromType`/`nodeToType` reader in `src/` or `ui/src/`. AGENTS.md §6 | Yes |
| A11 | `:4`, `:14`: under D15 old tools get only cheap fixes; old writers stay "unless a fix is one line"; `rules check` (A10.31) reports and `rules repair` fixes | `docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md:115-117` (D15: old tools aren't brought up to code; "An old route or tool is changed only when the fix is cheap"; the inconsistencies are "found by `rules check` and fixed by `rules repair`"). A10.31 is both `rules check` and `rules repair` (story 22 `:88`, story 26 `:74`) | Yes, as a proposal (it isn't one of the review's findings). "One line" is narrower than D15's "cheap" (R2-N3) |
| A12 | `:16`: the Pointer | The files it names exist. "corrected 2026-11-18" (see A3) | Yes, apart from the date |

### Ledger row `2026-11-18-enumerates-has-two-shapes`

| # | Claim (line) | Source checked | Holds? |
|---|---|---|---|
| B1 | The header fields and sections | As A1. The slug has four words, which is well-formed | Yes, apart from the date (B2) |
| B2 | The id's date, and `**Opened:** 2026-11-18` (`:3`, `:5`) | The file was created at 00:45:05Z on 2026-11-19 | No (R2-B2) |
| B3 | `:9`: BIBLE §6 says Superset → Property, and the enumerate route writes it that way | BIBLE §6 `:260`. `src/api/normalize/index.js:4204-4207` | Yes |
| B4 | `:9`: firmware install's five manifest enumerations go Superset → the target concept's JSON Schema, with the field in `destinationPath` ("around `:743` and `:795-800`") | `install.js:743`, `:775-800`. `manifest.json:401` (five entries) | Yes |
| B5 | `:9`: apply-enumerations reads only firmware's shape ("around `:5979`"), so an enumeration the enumerate route makes is never applied | `:5978-5981` | Yes |
| B6 | `:9`: firmware's `property-enumeration.json` describes a third shape, Concept Header → Property, "which no writer uses and no code reads" | "No writer uses": yes, since both writers start at a superset. "No code reads": no. The audit's wiring rule accepts only ListHeader → Property (`src/api/audit/index.js:141`, `:359`, `:783`). That rule accepts this third shape, because a concept header is a ListHeader (`_concepts.js:367`). It flags every edge both writers make, because a superset is a ListItem (`_concepts.js:362`). What round 1 found was that no code reads the definition's `nodeFromType`/`nodeToType` (N2, N3) | Partly (R2-B5) |
| B7 | `:4`, `:11`, `:13`: "Loom A10.19, `graph enumerate`" | No file in this repo maps A10.19. Nearby numbers: A10.18 is the property writes (ADR 0020a `:14`), and A10.20 is `graph create-element` (ADR 0020a `:5`) | Not checked: needs the Loom board (R2-N1) |
| B8 | `:11`: the fix shape. Pick one shape (BIBLE's is the documented one); `graph enumerate` writes it and whatever applies enumerations reads it; `rules check` reports the others; "firmware's own five can move when firmware is next reinstalled" | A proposal. On the last clause: install removes no ENUMERATES edge (its only deletes, `install.js:864` and `:892`, prune redundant HAS_ELEMENT and IS_A_SUPERSET_OF links), and its wiring (`:795-800`) has to change first | Yes as a proposal. The last clause needs those two steps (R2-N3) |
| B9 | `:13`: the Pointer | It leaves out the audit (R2-B5), readVerbs, and the firmware file's path (R2-N4) | Yes for what it names |

### Findings

#### Blocking

1. **R2-B1. `ledger/2026-11-18-old-routes-hang-properties-on-the-schema.md`: the id has seven slug words, and the lint fails on it.** OPEN.md `:20` allows two to six, and L15 enforces that (Gates). **Asked change:** a slug of at most six words, in both the filename and the `**Id:**` line, with R2-B2's date. One that passes the pattern: `2026-11-19-old-routes-hang-properties-on-schema` (checked with the pattern from OPEN.md `:20`).
2. **R2-B2. Both ids, and both `**Opened:**` lines, carry 2026-11-18, but both rows were minted on 2026-11-19 UTC.**
   - The files were created at 00:44:59Z and 00:45:05Z on 2026-11-19 (their `stat` birth times).
   - OPEN.md `:20` makes the id's date "the UTC day the row is minted (`date -u +%F`)", and the lint's own message says "the UTC date".
   - An id never changes once it is on `staging` (`:21`). Nothing cites either id yet: `git grep -F` finds only the files themselves. So now is the only time this can be fixed for free.
   - **Asked change:** `2026-11-19` in both filenames, both `**Id:**` lines and both `**Opened:**` lines, and "corrected 2026-11-19" in the old-routes row's Pointer (`:16`).
3. **R2-B3. `docs/CONFIGURATION.md:139`: CLASS_THREAD_PROPAGATION, "Superset → Superset/Set", leaves out a Set as the parent.**
   - The row is BIBLE §6 `:243` word for word. But BIBLE §11 makes sets under sets (`:487` add-subset and `:493` create-set, both "under a Superset or Set"). So do this epic's link-set (ADR 0028 `:11`, `:65`; `_sets.js:63-64`) and firmware (`class-thread-propagation.json:14`). The audit already says Superset/Set → Superset/Set (`src/api/audit/index.js:137`).
   - This is the same kind of gap as round-1 B1: the row leaves out ends the spec names elsewhere. A set that add-subset made under a set has no event behind it (BIBLE §11 `:487`), so the BIBLE §30 hazard applies too.
   - **Asked change:** `Superset/Set → Superset/Set`. Each of its four pairs has a source:
     - Superset → Superset: ADR 0028 `:11` (a concept's superset under a superset) and BIBLE §6 `:344`.
     - Superset → Set and Set → Set: BIBLE §11 `:487`, `:493`.
     - Set → Superset: ADR 0028 `:11` (a concept's superset under a set).
   - Optional: `docs/ARCHITECTURE.md:67` has the same gap, and this round left it unchanged.
4. **R2-B4. `ledger/2026-11-18-old-routes-hang-properties-on-the-schema.md:9` says how the incident happened, and the review did not find that.**
   - The clause is "An agent using today's routes to give a concept a property enumerated by another concept's superset". Round 1's brief describes the incident without the enumerate step. Round-1 claim 8 says the record doesn't show how the node got both edges.
   - If the clause is true, it names the enumerate route (`src/api/normalize/index.js:4209-4243`) as the cause, so it matters.
   - **Asked change:** give its source (the session or report it comes from), or drop that clause and keep "An agent using today's routes ended up with…".
5. **R2-B5. `ledger/2026-11-18-enumerates-has-two-shapes.md:9`: "no code reads" the third shape doesn't hold.**
   - The audit's wiring rule accepts only ListHeader → Property (`src/api/audit/index.js:141`, `:359`, `:783`).
   - That rule accepts firmware's Concept Header → Property, because a concept header is a ListHeader (`_concepts.js:367`).
   - It flags every edge both writers make, because a superset is a ListItem (`_concepts.js:362`).
   - Round 1 found only that no code reads the definition's `nodeFromType`/`nodeToType` (N2), and it suggested folding the audit into this row (N3). Whichever shape is chosen, the fix has to change the audit too.
   - **Asked change:** say what round 1 found. No code reads the definition's `nodeFromType`/`nodeToType`, and the audit's wiring rule expects ListHeader → Property, so it reports every ENUMERATES edge either writer makes as a violation. Add the audit to the Pointer (`:13`).

#### Non-blocking

1. **R2-N1. "Loom A10.19, `graph enumerate`" (`enumerates…:4`, `:11`, `:13`) can't be confirmed in this repo.** No file maps A10.19. **Suggested:** confirm it on the Loom board before the row lands. The row also names `graph enumerate` in words, so its meaning holds either way.
2. **R2-N2. The old-routes row names the readers but not their files** (`:11`), and its Pointer (`:16`) leaves out `ui/` and the audit.
   - **Suggested:** `ui/src/pages/concepts/ConceptOverview.jsx:18`, `ConceptList.jsx:28`, `ConceptProperties.jsx:27`, `src/api/audit/index.js:138`, `ui/src/pages/reading/readVerbs.js:395`, `:783`, `:844`, and the firmware file's full path, `firmware/active/concepts/relationship-type/elements/property-membership.json`.
   - Its create-property range, `:3478-3505`, is the target lookup. The edge is written at `:3551-3555`.
3. **R2-N3. Two fix shapes say a little more than their sources.**
   - Old-routes `:14`: "unless a fix is one line" is narrower than D15's "changed only when the fix is cheap" (`docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md:117`). "The design doc's D15" (`:4`) could also name that file.
   - ENUMERATES `:11`: "firmware's own five can move when firmware is next reinstalled". A reinstall alone moves nothing:
     - install's wiring (`src/firmware/install.js:795-800`) has to change first;
     - install removes no ENUMERATES edge (its only deletes prune redundant HAS_ELEMENT and IS_A_SUPERSET_OF links, `:864`, `:892`), so the five old edges need removing as a separate step.
4. **R2-N4. The ENUMERATES row leaves out the other reader.** readVerbs reads only Superset → Property (`readVerbs.js:394`, `:843`), so the reading pages don't show firmware install's five. Under the fix shape's preferred choice that reader is already right, so adding it is optional. The row could also give the firmware file's full path, `firmware/active/concepts/relationship-type/elements/property-enumeration.json`.
5. **R2-N5. ARCHITECTURE.md's unchanged rows.**
   - `:67` has R2-B3's gap.
   - `:68`, "Set/Superset → ListItem", is narrower than BIBLE §6 `:244`'s "Element". A concept's header, a ListHeader, is made an element of the `concept-header` concept (`_concepts.js:51`).
   - **Suggested:** make `:67` match the fixed CONFIGURATION.md row and `:68` read "→ Element", in this change or a later one.
6. **R2-N6. BIBLE §6 `:243` has the same gap that R2-B3 fixes in this doc**, as `:259` had round-1 B1's (which `:264` covers). A BIBLE edit is outside this lane. **Suggested:** an OPEN.md row, or the next docs-mode BIBLE change.
7. **R2-N7. Scope.** The change now covers four CONFIGURATION.md rows and two ARCHITECTURE.md rows, where round 1's brief named two rows. Each extra edit fixes a round-1 finding. No change asked.

### Corrections to round 1 (the Reviewer's own)

1. Round-1 N4 said: "BIBLE `:243` says Superset → Superset/Set, and so does firmware (`class-thread-propagation.json:14`, "Connects a Superset or Set to a child Set")". That was wrong. Firmware's definition also allows a Set as the parent, which BIBLE's row doesn't. The coordinator used BIBLE's wording because of that note, and that is where R2-B3 came from.
2. The same bullet cited `_sets.js:6` for "Sets are made under supersets and under other sets". The lines that say a parent may be a set are `_sets.js:64` and ADR 0028 `:11` and `:65`.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **L15 checks the shape of an id but not its date, and its message says "the UTC date".** So an id minted in the evening, US time, with the local date passes once its slug is right: R2-B2's two rows were minted 44 and 45 minutes after UTC midnight. **Suggested meta row:** L15 compares a committed row's id date with the UTC date of the commit that added it, or `scripts/session-start.sh` prints `date -u +%F` beside the ledger rule.
2. `npm test`, and the INFO line for this non-numbered review, are already covered by round 1's two open rows. No new row.

### Verdict

Five blocking items:
- The lint fails on one ledger id's seven-word slug (R2-B1).
- Both ledger ids carry the local date, not the UTC day they were minted (R2-B2).
- The PROPAGATION row leaves out a Set as the parent (R2-B3).
- One ledger claim has no source (R2-B4), and one doesn't hold (R2-B5).

The IS_A_PROPERTY_OF, TERMINATION and ENUMERATES rows hold, in both docs.

**CHANGES_REQUESTED**

## Round 3 — 2026-11-18 local, 2026-11-19 UTC (still uncommitted, over `d5deea223`)

The coordinator applied round 2's five blocking fixes and asked for another review. Nothing is committed. Since round 2:
- **Ledger renames.** `2026-11-18-old-routes-hang-properties-on-the-schema` is now `ledger/2026-11-19-old-routes-hang-properties-on-schema.md`, and `2026-11-18-enumerates-has-two-shapes` is now `ledger/2026-11-19-enumerates-has-two-shapes.md`. The 2026-11-18 files are gone. Round 2's tables above use the old ids.
- **`docs/CONFIGURATION.md:139` and `docs/ARCHITECTURE.md:67`**: IS_A_SUPERSET_OF is now Superset/Set → Superset/Set.
- **The old-routes row** now gives the incident's source and the owner's words, names the readers' files, and says "unless the fix is cheap".
- **The ENUMERATES row** now covers the audit's wiring rule, and its fix shape says a reinstall alone won't move firmware's five edges.
- **Two new rows** from round 2's non-blocking notes: `ledger/2026-11-19-bible-propagation-omits-set-parent.md` (docs) and `ledger/2026-11-19-lint-skips-ledger-id-date.md` (meta).
- **A10.19:** the coordinator reports confirming on its Loom page that A10.19 is `graph enumerate`.

I checked each change afresh against the sources, not against the coordinator's summary.

### Gates (run by the reviewer)

- [x] `git diff --check`: no output, exit 0. `git diff --stat`: `docs/ARCHITECTURE.md` +3 −3, `docs/CONFIGURATION.md` +4 −4. The four ledger rows are untracked.
- [x] `bash scripts/harness-lint.sh` before this section was written: last line `harness-lint: clean (0 violations)`, exit 0. With this section in place: the same last line, exit 0. Its one line about this file is the INFO line for a non-numbered review.
- [x] All four ids match OPEN.md `:20`'s pattern (two to six slug words, 64 characters at most), and each file's `**Id:**` repeats its name (L15). All four files were created between 00:59:24Z and 00:59:38Z on 2026-11-19 (`stat` birth times), so the date in each id is the UTC day the row was minted.
- [x] **No suite reads a changed line** (as in round 2).
- [ ] `npm test`: not run, for round 1's reasons.
- [x] **The owner's quote, read-only, against this session's transcript on this Mac.** This is outside the worktree, and I read nothing else there. The owner's message is a user message (not a tool result or an agent's text), timestamped 2026-11-19T00:20:08Z, which is 19:20 on 2026-11-18 US Eastern. It holds the words "(Both relationships were actually created.)" exactly, parentheses and full stop included. Its account of what happened matches the row's (claim 4). Nothing else from it is copied here.

### Round-2 findings, re-checked

- **R2-B1 (seven-word slug): fixed.** The lint is clean.
- **R2-B2 (local-day ids): fixed** in all four ids, both `**Opened:**` lines and the old-routes row's Pointer.
- **R2-B3 (PROPAGATION): fixed** in both docs (claims 1–2 below).
- **R2-B4 (incident without a source): fixed.** The row now cites the owner's report with a date, quotes his words unedited (design-philosophies/README.md, "Quoted owner's words are not edited"), and the quote checks out (Gates).
- **R2-B5 ("no code reads"): fixed.** The row now names the audit's rule and puts the audit in its Pointer.
- **R2-N1 (A10.19):** confirmed by the coordinator on Loom. I did not re-check it.
- **R2-N2 (readers' files): mostly done.** One reader is still named without its file (R3-N3).
- **R2-N3 (D15's word; the reinstall): done** (claims 8 and 11).
- **R2-N4 (readVerbs and the firmware path in the ENUMERATES row), R2-N5's `→ ListItem` (`docs/ARCHITECTURE.md:68`), and the D15 file name:** left as they were, as the coordinator chose. All three were optional.
- **R2-N6 (BIBLE §6 `:243`): recorded** as the new docs row (claims 13–16).
- **Round-2 friction 1 (L15 skips the date): recorded** as the new meta row (claims 17–20). One of its claims slips (R3-N1).

### Changed rows and ledger claims

| # | Where | Claim | Source checked | Holds? |
|---|---|---|---|---|
| 1 | `docs/CONFIGURATION.md:139` | CLASS_THREAD_PROPAGATION: "Superset/Set → Superset/Set" | Superset → Superset: ADR 0028 `:11` (a concept's superset under a superset), BIBLE §6 `:344`. Superset → Set and Set → Set: BIBLE §11 `:487`, `:493`. Set → Superset: ADR 0028 `:11` (a concept's superset under a set). Also firmware's `class-thread-propagation.json:14` and the audit's rule, `src/api/audit/index.js:137`, in the same words | Yes (R2-B3 fixed) |
| 2 | `docs/ARCHITECTURE.md:67` | IS_A_SUPERSET_OF: "Superset/Set → Superset/Set (class thread propagation)" | As claim 1 | Yes |
| 3 | Both tables' other changed rows | Round 2's lines, unchanged | `git diff`: CONFIGURATION.md `:140`, `:141`, `:143` and ARCHITECTURE.md `:69`, `:71` are as round 2 found them, and those held | Yes |
| 4 | Old-routes `:9` | "The owner reported on 2026-11-18 that Grok Bot, an admin agent, used today's routes to have the Grok Bots concept's property for the projects a bot works on enumerated by the Projects concept's superset, and that the routes hung the new property under both the concept's primary property and its JSON Schema" | The owner's message (Gates) says this. "An admin agent" isn't in his message, but the design doc's "Who uses it" (owner, 2026-11-07, `docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md`) lists Grok Bot as holding one of the admins' keys. "By `IS_A_PROPERTY_OF`" sits outside the quotation marks and names the relationship his message calls by a shorter name | Yes (R2-B4 fixed) |
| 5 | Old-routes `:9` | The quote "(Both relationships were actually created.)" | His message, word for word (Gates) | Yes |
| 6 | Old-routes `:9` | The new property writes "refuse a concept whose tree has a node with two parents (`tangled-tree`)" | `_properties.js:576`, `:655-658`. Round 2's A6 | Yes |
| 7 | Old-routes `:11` | The readers' files | `ui/src/pages/concepts/ConceptOverview.jsx` and `ConceptList.jsx`, `ui/src/pages/concepts/ConceptProperties.jsx` and `src/api/audit/index.js` hold the reads round-1 N2 named | Yes. readVerbs is named without its file (R3-N3) |
| 8 | Old-routes `:12`, `:14` | `property-membership.json`'s `nodeToType`: "no code reads that field". The old writers stay "unless the fix is cheap" | No `nodeFromType`/`nodeToType` reader in `src/` or `ui/src/`. D15: "changed only when the fix is cheap" (`docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md:117`) | Yes |
| 9 | Old-routes `:16` | Pointer: "corrected 2026-11-19", and the audit | Gates (the UTC day); the file exists | Yes |
| 10 | ENUMERATES `:9` | The audit's wiring rule "accepts only that shape (ListHeader → Property), so it flags every edge both writers make" | `src/api/audit/index.js:141`, `:359`, `:783`. A concept header is a ListHeader (`_concepts.js:367`), so the rule is the definition's shape widened to any list header. Every edge a writer makes starts at a superset, which is a ListItem (`_concepts.js:362`), and firmware's edges end at a JSONSchema | Yes (R2-B5 fixed) |
| 11 | ENUMERATES `:11` | "a reinstall alone won't do it, since install never deletes `ENUMERATES` edges" | Both install routes run `src/firmware/install.js` (`src/api/firmware/index.js:16`, `src/api/normalize/index.js:5713`). Install's only deletes prune redundant HAS_ELEMENT and IS_A_SUPERSET_OF links (`:864`, `:892`). The only other delete on its path removes an event's tag nodes (`src/api/normalize/helpers.js:97`, in `importEventDirect`, which install reaches through `regenerateJson`) | Yes |
| 12 | ENUMERATES `:11`, `:13` | The audit and `rules check` accept the chosen shape and report the others; the audit is in the Pointer | A proposal; the file exists | Yes |
| 13 | New docs row (`bible-propagation-omits-set-parent`) `:3-7` | The header fields: `**Type:** docs`, opened at round 2 | `templates/open-row.md`; L15 clean | Yes |
| 14 | Same, `:9` | BIBLE §6 gives IS_A_SUPERSET_OF as Superset → Superset/Set | BIBLE §6 `:243` | Yes |
| 15 | Same, `:9` | Sets are made and linked under other sets (BIBLE §11's add-subset and create-set; ADR 0028's link-set); firmware's definition allows it; the audit uses Superset/Set → Superset/Set; the two docs now say so and BIBLE §6 doesn't | BIBLE §11 `:487`, `:493`. ADR 0028 `:11`, `:65`. `class-thread-propagation.json:14`. `src/api/audit/index.js:137`. Claims 1–2 | Yes |
| 16 | Same, `:11`, `:13` | The fix goes through the Protocol-Spec workflow's docs mode | `engineering-team/workflows/protocol-spec-workflow.md`; CLAUDE.md, "Protocol-spec variant" | Yes |
| 17 | New meta row (`lint-skips-ledger-id-date`) `:3-7` | The header fields: `**Type:** meta` | As claim 13 | Yes |
| 18 | Same, `:9` | OPEN.md makes an id's date the UTC day the row is minted | OPEN.md `:20` | Yes |
| 19 | Same, `:9` | Two rows were first written at about 00:45 UTC on 2026-11-19 with ids dated 2026-11-18, the writer's local day, "and lint L15 passed them: it checks an id's shape, not its date" | The times: 00:44:59Z and 00:45:05Z (round 2). L15 (`scripts/harness-lint.sh`, `check_L15`) checks the filename's shape and length, `**Id:**`, `**Type:**`, `**Opened:**` and `**Status:**`, and compares no date: yes. But L15 didn't pass both rows. Round 2's run flagged the old-routes row for its seven-word slug | Partly (R3-N1) |
| 20 | Same, `:9`, `:11`, `:13` | The review caught it and the rows were renamed before staging. Fix shape: L15 compares a new or uncommitted file's date with today's UTC date and warns. Pointer: OPEN.md and `check_L15` | The renames (Gates). A proposal. `scripts/harness-lint.sh:398` | Yes |
| 21 | ENUMERATES `:4`, `:11`, `:13` | "Loom A10.19, `graph enumerate`" | The coordinator reports checking its Loom page. No file in this repo maps it | Not re-checked by the Reviewer; the coordinator's check stands |

### Findings

#### Blocking

None.

#### Non-blocking

1. **R3-N1. The meta row's "lint L15 passed them" (`ledger/2026-11-19-lint-skips-ledger-id-date.md:9`) isn't quite what happened.** L15 raised nothing about either date, but in round 2 it did flag one of the two rows, the old-routes row, for its seven-word slug. The row's point stands: L15 checks an id's shape, not its date. **Suggested:** "and lint L15 raised nothing about their dates (it flagged one of them only for a seven-word slug): it checks an id's shape, not its date."
2. **R3-N2. "The owner reported on 2026-11-18" (`old-routes…:9`) gives the US Eastern day.** His message is timestamped 00:20 UTC on 2026-11-19, the UTC day the row's own id carries. No rule fixes which day a report's date uses. **Optional:** add "(US Eastern)".
3. **R3-N3. The old-routes row names readVerbs without its file** (`:11`): `ui/src/pages/reading/readVerbs.js`. Optional.
4. **R3-N4. Still open by choice, no change asked:**
   - `docs/ARCHITECTURE.md:68`'s "→ ListItem" (R2-N5), which now differs from CONFIGURATION.md's "→ Element";
   - the ENUMERATES row's missing readVerbs and firmware path (R2-N4);
   - the D15 file name (R2-N3);
   - the stale "BIBLE §9" references outside the diff (round-1 N5).

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. None new. Round 2's friction 1 is now its own row, the meta row above.

### Close-out

- [x] No story to mark Done, and no book (0-intake step 3, `:39`).
- [ ] Commit: left to the coordinator, who asked the Reviewer not to commit. A suggested message: `review: configuration-relationship-directions — PASS (graph-operations-first-slice, doc lane)`. The commit takes the two docs, the four ledger rows and this file. The R3-N1 rewording, if made, changes a single phrase in one row.

### Verdict

Round 2's five blocking items are fixed, and each fix holds against its sources:
- the ledger ids are well-formed and carry the UTC day each row was minted;
- the PROPAGATION row names sets as parents, in both docs;
- the incident has its source, with the owner's words checked against his message;
- the ENUMERATES row names the audit.

Every claim in both docs' changed rows holds. The four ledger rows say what the review found, apart from one slip about L15 that misleads no one (R3-N1). The lint is clean.

**PASS**
