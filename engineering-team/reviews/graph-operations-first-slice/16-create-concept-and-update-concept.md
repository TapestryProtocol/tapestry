# Review: Story 16 — `graph create-concept` and `update-concept`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-15
**Diff:** `git diff 0b1d2a26...HEAD` (commit `410a6ed2`, branch `A10.16-create-update-concept`). Eight commits: `76f94add` (ADR 0016 Amendment 1), `69a2da17` (the test plan and the failing tests), `e3377285` and `0ec54c31` (two Tester corrections: CC3's wrapped schema, and the seed's beagle), `bef10d73` (Amendment 2, the owner's ruling on memberships), `37d8f3d3` (CC2 to Amendment 2), `2ed0728d` (the implementation), `410a6ed2` (the live check's record and a ledger file). 25 files, 3,134 lines added, 18 removed.

The base, `0b1d2a26`, is staging's merge of the story-and-ADR pull request (#69). The live check ran on throwaway scratch instances that have since been removed. This review judges it from its record (the test plan's Verification, the story's Evidence) and re-runs every stack-free check itself. An independent Reviewer agent wrote it. The optional independent check before the commit (workflow 5, P13) was not applied.

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run.** On this machine the full gate writes to the owner's agent-memory instance (container `tapestry`, `:7778`), and this review's rule forbids it, as it forbids a scratch stack.
  - `npm run gate:status` is not quoted: on this Mac it prints another commit's record (ledger `2026-11-15-gate-status-shows-another-commits-run`).
  - The branch is pushed: `origin/A10.16-create-update-concept` holds `410a6ed2`. This review made no GitHub calls. CI's run on the pull request will be the first full gate of `410a6ed2`.
- [x] **The stack-free operations gate, `node test/operations.test.js`:** **377 passed, 0 failed, 0 skipped, exit 0**, in 56 s. It ran on Node 24.18.0 at `410a6ed2`, with a clean tree apart from the untracked `node_modules` link. Every endpoint was dead: Neo4j, Redis, Meilisearch, both base URLs and `TAPESTRY_PORT` at port 9, and `TAPESTRY_CONTAINER=no-such-container`. The test plan records 377.
  - This story's suites inside it: create-concept 17/0/0, update-concept 7/0/0, the rule concept-slug-unique 5/0/0, concept names 4/0/0, the agent through the external CLI 1/0/0, and the fake graph 21/0/0.
  - The suites that share the fake give the test plan's numbers:
    - add-relationship 12, remove-relationship 7, history 8;
    - mark-field 16, unmark-field 13, map-fields 12, fields 8;
    - the two agents 1 each, the write path 13, change-entry fields 3, change indexes 3;
    - field-mark-allowed 14, relationship-type-allowed 10.
  - Tapestry keys on every node, which reads the new files (G4, G11, G18, G19), gave 19.
- [x] **The route-surface suites.** I screened each, and the helpers they load (`accessHarness.js`, `externalCliServer.js`, `routeWalk.js`), for `:7778`, `docker exec` and live endpoints. Then I ran them one by one with the same dead endpoints:
  - openapi-coverage 13/0/0, default-deny-mutations 14/0/0, admin-action-sweep 9/0/0;
  - admin-action-sweep-access 13/0/0, close-unauth-write-surface 14/0/0, external-cli 53/0/0.
- [x] **Red before green.** I exported HEAD's tree to the scratchpad and put `0b1d2a26`'s `src/` and `docs/` back in it. The results were the fake graph 21/0, concept names 0/4, create-concept 0/17, update-concept 0/7, the rule 0/5 and the agent 0/1: the test plan's figures.
  - Each failure names the file it waits for and its decision, such as "src/operations/catalog/graph/create-concept.js does not exist yet (… Decision 7)".
  - CS5 fails on the rules document's missing §4.
- [x] **The tests catch what the amendments forbid.** I broke the real code one line at a time, in a scratch copy of HEAD:
  - Amendment 2 off, so the superset joins `word` again (`_concepts.js:52`): CC2 failed.
  - The lock off (`create-concept.js:71`): CC13 failed.
  - The rename's hand-edit guard off (`_concepts.js:696`): UC2 failed.
  - The re-check after the lock off (`create-concept.js:77`): **all 17 passed** (Non-blocking 4).
- [x] **The phases kept to their lanes.**
  - `git diff 2ed0728d..HEAD -- test/` is empty, and neither implementation commit touches `test/`.
  - `git diff 0b1d2a26..37d8f3d3 -- src/ bin/ docs/ firmware/ clients/ ui/` is empty: the Tester's four commits changed no code. `69a2da17`'s one story line is the test plan's link.
  - The two amendments add their sections and mark each Decision they change in place: `(Amended: …)`, `(Amendment 1.1)`, `(Amendment 1.2)`.
- [x] **The shipped catalog,** loaded with dead endpoints: 15 operations, and no problems.
  - Both new operations are `POST /api/tapestry/graph/<name>` for the owner and admins, with guard `concept-slug-unique` and their `repeatKey`s.
  - Each has a route-table entry at `owner`, as story 5's operations do.
  - The rule loads, with `refuses: true` and no rule problems.
- [x] **A probe of the edge cases the suites don't pin.** It ran the real catalog over the suites' own seed and harness, with the spy on: twelve requests, and nothing signed. Its results are cited below as "the probe".
- [x] `bash scripts/harness-lint.sh`: clean, 0 violations, run after this file was written. Its first run read this file as passed, from the template's closing heading, so that heading is dropped (Harness friction 1).
- [ ] `npm run test:playwright`: not applicable. No UI changed.
- [ ] _Lint not configured — skipped._ _Typecheck not configured — skipped._ _Build not configured — skipped._

## Spec adherence

| Criterion | Evidence | Holds |
|---|---|---|
| AC1, create a concept | CC1: eight nodes with no `NostrEvent`, each keyed, its name its tapestryValue, no `id`, the assistant its would-be author; the entry names all eight; the note on backups. CC15: the spy saw nothing. CC16 | yes |
| AC2, it reads like today's | CC2, against today's route run in a sandbox: addresses, labels, names, tags (plus the `o` tag), the import's tag uuids, json text byte for byte, wiring, and Amendment 2's memberships exactly. CC3, CC4. L1 from its record | yes |
| AC3, safe to repeat by slug | CC5, CC6, CC13. The probe: `differs` names the name (`feline` given, `cat` held). L2 from its record | yes; two calls at once from L2 only |
| AC4, near matches | CC7: same slug, same name, plural swap, the cap and `moreSimilar` | yes |
| AC5, names | CC11, UC6, CN2–CN4 | yes; see Non-blocking 1–3 |
| AC6, update a concept | UC1–UC5 | **no, for headers whose `names` tag has no plural** (Blocking 1) |
| AC7, the refusals and the rule | UC6, CC8, CS1–CS5, `docs/GRAPH_RULES.md` §4 | yes; see Non-blocking 5 |
| AC8, it lasts and reaches agents | CC15–CC17, UC7 (401, 403, 415, the command, the list, `/docs`), X3. L3–L6 from their record | yes; the reinstall from its record (Non-blocking 6) |

- No criterion is silently dropped.
- The diff adds one thing the story doesn't name: the ledger file, which records a bug the live check found in today's concepts. That is in place.
- The Deviations section names every departure I found but one (Non-blocking 10).

## ADR adherence

- [x] **Files match the Implementation notes,** with one exception: `rename(old, now)` is `renameRows(facts, d, ta, oldNames, newNames)`.
- [x] **The statements are C1–C11,** with two drifts:
  - C3 names no label on its header (`_concepts.js:578-579`; Non-blocking 10);
  - C8 adds `LIMIT 500`, which is in the story's Deviations.
- [ ] **Decision 2's "before they read the graph"** holds only for create-concept's name (Non-blocking 1).
- [x] **Layering.** Every read and write goes through `ctx.tx` (the graph seam), and the rule goes through the `read` it is given. Each module requires the firmware, the assistant's key and the store only when first called, so nothing opens at load.
- [x] **No new dependency.** The new modules require Node's `crypto` and the repo's own modules, and no package file changed.
- [x] **Amendment 2's table is `MEMBERSHIPS`** (`_concepts.js:50-59`): ten memberships. `not-installed` still asks for all twelve firmware concepts (`FIRMWARE_SLUGS`, `_concepts.js:44`).

## Concept-graph integrity

- [x] **Handles are in `kind:pubkey:slug` form.** Addresses are `39998:<TA>:<d>` and `39999:<TA>:<d>-<suffix>`, and `z` tags are `firmware.conceptUuid(<slug>)`. The TA is resolved at runtime, through `getOwnerAssistantPubkey()` and `firmware.getTAPubkey()`. No added `src` line holds a 64-hex literal.
- [x] **Firmware reinstall:** not needed. No concept definition changed (ADR Consequences).
- [x] **`/summaries`:** not applicable to server code. The live check read the concept through `summaries`, `node`, `neighbors` and `core-nodes` (L1).

## The architecture invariants

1. **POV-first.** "This instance's own" is a fact about authorship, not trust: the header's `pubkey` is the assistant's. The rule, the repeat and update-concept's ownership refusal all concern the instance's own graph, which has one author. Near matches report every author's concepts unweighted, and leave trust to whoever reads them (Decision 8; Non-blocking 12). Nothing per-POV is stored.
2. **Decentralized-first.** Another author's concept is never refused, changed or counted against the rule:
   - CS2: another author's slug and key don't count for a create;
   - CS3: an item for another author's concept has no violations;
   - UC3: an own concept may take a slug another author uses;
   - UC6: `not-own-concept` changes nothing.

   Nothing gates what anyone publishes.
3. **Filter at view time.** Near matches and the rule read the headers on each call. Nothing derived is stored.
4. **Local-first.** Nothing this diff writes destroys local graph state:
   - create-concept only creates: `CREATE` for nodes, and `MERGE` for edges.
   - update-concept writes in place, and keeps a value someone edited by hand (UC2, and the mutation check). It never writes the LMDB: a json tag held there is read through the store, and its new value is written inline into the graph (Decision 9).
   - The only thing update-concept deletes is a description tag the caller empties, and its entry keeps the old text as `was`.
   - The lock sets and removes one property in one statement, and leaves nothing behind.
   - The live re-check found a renamed concept's tags unchanged by a reinstall (L3). The cache the derive step keeps stays stale after a rename, which is the ADR's acknowledged debt (A10.36).

## Things tests can't catch

- [x] **No secrets in committed files.** The seed's keys are patterns such as `'ee'.repeat(32)`.
- [x] **No leftover debug logging,** `console.log`, `debugger` or TODO in the added lines.
- [x] **No commented-out code.**
- [ ] **Error paths and edge cases:** one wrong result (Blocking 1); two counts not checked (Non-blocking 7).
- [ ] **Concurrency.** The lock is taken first (CC13) and held two creates of one name to one concept (L2). The re-check that guards a create against a concurrent slug change is pinned by nothing (Non-blocking 4).
- [ ] **Security.** The injection surface is closed:
  - labels come from a fixed list (`_eventless.js:26`, `:61-62`);
  - relationship types come from firmware's `relAlias`, never from input;
  - every value is a parameter, and the schemas bound the inputs.

  Two problems remain: literal text-direction controls in the source (Blocking 2), and invisible format characters accepted in names (Non-blocking 3).

## House rules check

- [x] **Concept Graph API authority respected.** The live check read the concepts through the concept-graph API (L1).
- [x] **No new lint, typecheck or build tooling.**
- [x] **The TA pubkey is never hardcoded.** The `LEGACY_*` constants are untouched.

## Product-guide adherence

Not applicable: the story traces to no PRD, and no UI changed.

## Findings

### Blocking

1. **`src/operations/catalog/graph/_concepts.js:683` — a rename of a header whose `names` tag holds no plural never lands, and every repeat records another entry.**
   - **The fault.** The rename rule rewrites a `names` tag only when the tag holds the old build's whole tag (`cur.value1 === w[2]`). A tag with no plural (`value1`) never matches, so it keeps the old singular.
   - **What follows.** Decision 4 reads a concept's singular from that tag first (`_concepts.js:402`), so after the call the concept still holds its old name. The answer says `updated`, with the new name, and the header's `name` and the JSON's `oNames` hold the new name too, so the concept now disagrees with itself.
   - **The repeat.** The same call again reads the same old name (`update-concept.js:76`), finds the name changed (`:90`), and records another `concept-updated` entry (`:146`). It never answers `unchanged`.
   - **Measured.** The probe stripped the plural from mouse's `names` tag, then called `update-concept` with `name: "rat"` twice. Both calls answered `updated`, and each recorded an entry for `name`, `mouse` → `rat` (`4f9303ab…`, then `be4b3d72…`). The graph ended with `names` `["names","mouse"]`, header `name` `rat` and `oNames.singular` `rat`.
   - **Why it blocks.** For this shape the call fails AC6 twice over: "the concept holds the new values", and "given values it already holds, it changes nothing, records nothing and answers `unchanged`". It also breaks the repeat contract `/docs` publishes for it ("calling it again with the same ones changes nothing and records nothing", `src/operations/openapi.js:65`), and fills `graph history` with entries that changed nothing. This is the rebuild's write path (A10.39), where agents rerun steps by design.
   - **Why the shape is real.**
     - The protocol doesn't require a plural in `names`, and Decision 4 provides for its absence ("the `names` tag's `value` and `value1`, else `oNames`").
     - An own header can carry one. The dlist-curation route copies a community header's `names` tag verbatim into the header it signs (`src/api/dlist-curation/index.js:110-113`). For the owner, it signs with the owner's assistant keys (`src/utils/assistantKeys.js:20-24`), which are the instance's assistant's.
   - **Asked change.** Make a rename reach the `names` tag's singular whether or not the tag holds a plural; what to do with an absent `value1` is the Implementer's and Architect's call. Once the call returns, the concept as Decision 4 reads it must hold the new names, and the same call again must answer `unchanged` with `change: null`. Add the case to the seed as a Tester correction, in its own commit as this story's two were: a header whose `names` tag has no plural, renamed and then renamed again.

2. **`src/lib/conceptNames.js:24` — the text-direction regex holds the control characters themselves, not escapes.**
   - **The fault.** The line holds U+202A, U+202E, U+2066 and U+2069. Neither of the first two is closed on the line: there is no U+202C.
   - **What it does to the reader.** In a viewer that applies the Unicode bidirectional algorithm, which most editors do, the rest of the line after U+202E displays in reversed order. GitHub marks such a file with a warning about hidden bidirectional text. So the line doesn't show what the parser reads: the "Trojan Source" pattern (CVE-2021-42574).
   - **The precedent.** The module this was copied from writes the same range with escapes: `/[\u202A-\u202E\u2066-\u2069]/u` (`src/lib/conceptHeaderEdit.js:45`).
   - **The tests do the same.** The Tester's literals hold the characters too: `test/operations/graph/create-concept.test.js:109` (a raw U+202E between `'bi` and `di'`) and `test/operations/graph/concept-names.test.js:55` (U+202E and U+2066).
   - **Why it blocks.** It is a source-review hazard no test can see. It sits in production code, in a check against text that reads differently from what it is, and on the pull request the owner will read. The fix is mechanical.
   - **Asked change.**
     - Write the range with `\u` escapes, as `conceptHeaderEdit.js:45` does.
     - Write the two test strings as `'bi\u202Edi'` and `'iso\u2066late'`, as a Tester correction.
     - Afterwards a scan of `src/` and `test/` for U+202A–U+202E and U+2066–U+2069 should find only the older `test/dictionary-resync-concept.test.js:253` (Non-blocking 11).

### Non-blocking

1. **Refusal order: `create-concept.js:63` with `_concepts.js:129-136`, and `update-concept.js:55` with `:64`.** Decision 2 says both operations refuse a bad name or description "before they read the graph". That holds only for create-concept's name, for which `createItems` gives no item.
   - A bad plural or description is checked in `apply`, after the guard has read every own concept, and so is any bad input to an update that gives a slug. A guard violation answers first.
   - The probe:
     - a create of `cat`, with plural `!!!` or with a NUL in its description, answers `key-in-use`, not `bad-name` or `bad-description`;
     - an update of beagle to slug `feline` with name `   ` answers `slug-in-use`, not `bad-name`;
     - an update of the firmware's word concept to slug `beagle` answers `slug-in-use`, not `firmware-concept`.
   - Nothing is written in any order. Either give the guards no items when an input has a problem, or correct Decision 2's sentence.
2. **`src/lib/conceptNames.js:71`: a name in a non-Latin script is refused for the wrong reason.**
   - `собака` and `日本語` are refused `bad-name`: "it has no letter or digit, so it would have no slug". The refusal follows Decision 2, since `dtag.slug` keeps only `a-z` and `0-9` (`src/lib/dtag.js:23-29`), but both names have letters. Say which letters a slug keeps.
   - The limit itself, that no concept can be named in a non-Latin script, is worth a Loom memo for the rebuild (A10.39).
3. **`src/lib/conceptNames.js:22-24`: invisible format characters pass.** The probe made a concept named `be\u200Bagle`, with a zero-width space:
   - it reads as "beagle";
   - it sits at `39998:<TA>:be-agle`, with that zero-width space in its slug;
   - its answer reported no near match, beagle included.

   AC5's list is met, since U+200B is a format character (`\p{Cf}`), not a control (`\p{Cc}`). The Dictionary's edit has the same gap. A follow-up could refuse format characters, except the ones some scripts need: the zero-width joiner and non-joiner.
4. **`create-concept.js:77` and `update-concept.js:66`: the re-check after the lock is pinned by nothing.**
   - With create-concept's re-check removed, all 17 of its tests pass. The fake has no concurrency.
   - L2 ran two creates of one name. The `existing` read at `create-concept.js:80` answers that case with or without the re-check.
   - The re-check exists for other cases, and no suite or live step has either: a create whose key comes into use only when a concurrent `update-concept --slug` commits, and two updates giving two concepts one slug.
   - It is right by inspection. Add one of those cases to the next live check.
5. **`update-concept.js:81`: a rename *onto* a name-keyed name is allowed.**
   - It refuses a new singular *for* a name-keyed concept, as Decision 9 says.
   - The Dictionary's edit refuses both directions (`src/api/adoption/editConcept.js:131` and `:138`: "so no other concept can take it"), because the server finds those concepts by name.
   - The goal lookup, for one, takes `LIMIT 1` of any `NostrEvent` header named `tapestry owner goal` (`src/api/normalize/index.js:2194-2199`). So a lettered own concept renamed to that name can turn the goal features onto the wrong concept. A concept with no event isn't found by those lookups.
   - This is a gap in AC7, not a deviation from it. It needs the owner's ruling.
6. **The ledger's likely cause doesn't fit the live record** (`ledger/2026-11-15-reinstall-drops-a-supersets-own-membership.md`).
   - **What pass 1e does.** It prunes a concept's direct element whenever an `IS_A_SUPERSET_OF|HAS_ELEMENT*2..12` path also reaches it (`src/firmware/install.js:781-805`). It does so for `NostrEvent|TapestryNode` nodes alike. The superset concept has a manifest, so its direct elements are among those it prunes.
   - **The conflict.** The ledger blames the path from the superset concept's superset, through set's superset, to the node. That path exists just the same for every superset create-concept makes, since Amendment 2 wires each into both `superset` and `set`. Yet the record says those memberships survived both reinstall runs.
   - **What that means.** Either the cause is something else, or what pass 1e prunes depends on the order in which it meets the edges. Then AC8's reinstall result, on another instance, rests on behavior nobody has explained.
   - **Asked.** Say so in the ledger, so whoever fixes pass 1e re-derives the cause, and repeat L3 at the next scratch run that touches concepts.
7. **Counts not checked.** `create-concept.js:105-116` never reads the `count(r)` its `MERGE` returns, and `update-concept.js:137` ignores the count `writeCopies` returns. No path reaches a missing endpoint today: `makeNode` throws without a key, and `supersetsOf` refuses a missing superset. A check would be cheap, like the one `addTags` makes at `_eventless.js:53-54`.
8. **Three full reads of the own concepts per create:** the guard, the re-check and the `existing` read (`create-concept.js:63`, `:77`, `:80`). Each returns every own header's json tag (`_concepts.js:419-431`), so each create costs time in proportion to the instance's concepts. That's fine now, and worth measuring before the rebuild (A10.39) makes hundreds in a row.
9. **Test gaps worth closing.** The name branch of `differs` (`create-concept.js:85`) has no test, and neither has plural-swap's other direction, a concept whose singular is the plural asked for. The probe saw `differs` name `feline` given and `cat` held, correctly.
10. **C3 names no label on its header** (`_concepts.js:578-579`), where the ADR's statement names `NostrEvent|TapestryNode`, and the story's Deviations don't say so.
    - It matches by uuid alone, so it finds the same nodes, and G11 passes.
    - Without a label, Neo4j can't seek the uuid index for it, and has to start elsewhere, most likely from the `Superset` label (not checked with `EXPLAIN`).
    - Align the read with the ADR, or list it as a deviation.
11. **Not in this diff:** `test/dictionary-resync-concept.test.js:253` holds a literal U+202E too. It is worth an OPEN.md row.
12. **Near matches are ordered by address within each kind,** which means by the author's pubkey (`_concepts.js:568`). Ten headers by authors whose keys sort first can fill `same-slug` ahead of a shared concept the owner trusts; `moreSimilar` still says there were more. That is Decision 8 as ruled: nothing is weighed by trust, and the reader's POV decides. It is noted for when the list gets a POV.

### Harness friction

1. **None new; two known ones recurred.**
   - **The template's closing heading reads as the verdict.** Written to the template, this review first linted as passed: the template puts `## On PASS (same commit)` after `## Verdict`, and the lint takes the last verdict token. The heading is dropped here.
     - This is ledger `2026-10-07-on-pass-heading-reads-as-verdict` (OPEN.md row 272), now with eight known occurrences.
     - This commit holds only the review, so the ledger's list of occurrences isn't updated here.
   - **`npm run gate:status` can't be quoted on this Mac.** That is ledger `2026-11-15-gate-status-shows-another-commits-run`, already open.

## Verdict

**CHANGES_REQUESTED**

Blocking 1 is a wrong result on legitimate input, measured, and Blocking 2 is a source-review hazard. Otherwise the diff matches the story, the ADR and its amendments, and the test plan, and every stack-free gate is clean.

The story stays `Approved`, and no completion check runs until a later round passes the fixed diff.
