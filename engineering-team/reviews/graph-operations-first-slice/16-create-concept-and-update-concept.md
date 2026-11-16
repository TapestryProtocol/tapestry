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

---

## Round 2 — 2026-11-15 (HEAD `aee7b472`)

**Diff checked:** `git diff 52ca6e8a..aee7b472`: six commits, 14 files, 228 lines added and 39 removed.
- `b1baf5a8` (test): the review's cases, a third Tester correction.
- `ab3da897` (adr): Amendment 3, items 1–5.
- `6fecadd1` (impl): round 1's fixes, the story's Deviations and three ledger files.
- `0967db46` (test): UC10.
- `ec645747` (adr): Amendment 3.6, and AC7's ruled bullet.
- `aee7b472` (impl): the ruling, the catalog row and the test plan's run record.

I checked every change as a new claim, including round 1's suggested wording. The independent check before the commit (workflow 5, P13) was not applied.

### Gates (run by the reviewer at `aee7b472`)

- [ ] **`npm test`: not run,** for round 1's reason: on this Mac the full gate writes to the owner's agent-memory instance. `npm run gate:status` is not quoted (ledger `2026-11-15-gate-status-shows-another-commits-run`). No GitHub calls were made, and nothing was pushed.
- [x] **The stack-free operations gate:** **384 passed, 0 failed, 0 skipped, exit 0,** in 56 s.
  - It ran on Node 24.18.0, with a clean tree apart from the untracked `node_modules` link, and every endpoint dead as in round 1.
  - This story's suites: create-concept 21, update-concept 10, concept names 4, the rule 5, the fake graph 21, the agent 1, none failed.
  - The test plan records 384.
- [x] **The route-surface suites.**
  - Neither they nor their helpers have changed since round 1's screen. I screened them again. The host-like strings are `.example` payloads, and I10's `http://example.com`, which the CLI refuses before it sends anything.
  - Run one at a time, endpoints dead: openapi-coverage 13/0/0, default-deny-mutations 14/0/0, admin-action-sweep 9/0/0, admin-action-sweep-access 13/0/0, close-unauth-write-surface 14/0/0, external-cli 53/0/0.
- [x] **The shipped catalog,** loaded with dead endpoints: 15 operations, and no problems. Both operations list the rule's `slug-in-use` and `key-in-use` among their refusals, and `name-keyed`'s `when` has the round's wording.
- [x] **Red before green,** in scratch copies under the scratchpad, never in the worktree:
  - **HEAD's tree with `52ca6e8a`'s `src/` put back:** concept names 3/1 (CN3), create-concept 19/2 (CC11b, CC20), update-concept 7/3 (UC8, UC9, UC10). Each fails for its own reason:
    - the zero-width name passes, and is created;
    - the bad plural answers `key-in-use`;
    - the repeated rename answers `updated`;
    - the bad name answers `slug-in-use`;
    - bird's rename onto `tapestry owner goal` answers `updated`.
  - **The test plan's figures:** `b1baf5a8`'s own tree gives 3/1, 19/2 and 7/2, and `0967db46`'s gives update-concept 9/1 (UC10).
- [x] **Mutations** of HEAD's code, one at a time, in a scratch copy:
  - Each of these fails its test:
    - a tag with no `value1` no longer holding the old one, or `value1` always added (UC8);
    - either guard ignoring `anyBadInput` (CC20; UC9);
    - no format-character check (CN3, CC11b), or no stray-joiner check (CN3);
    - every joiner refused (CN3's Persian case);
    - no onto check (UC10);
    - the old no-slug message (CN3, CC11b).
  - Four pass every suite: either count check removed (`create-concept.js:113`, `update-concept.js:144`), and the stray-joiner rule without its end anchors, or without white space among the neighbours (R2-3).
- [x] **The phases kept to their lanes.**
  - The two test commits touch only `test/` and the test plan.
  - The two implementation commits touch no `test/`. `aee7b472`'s four test-plan lines are its run record, as `410a6ed2`'s were.
  - The ADR commits touch the ADR. `ec645747` also touches the story in two places: AC7's bullet, marked as the owner's ruling, and one Deviations bullet that records it.
  - In both halves the test commit came before the amendment recording what it pins: `b1baf5a8` before `ab3da897`, and `0967db46` before `ec645747`. Each pins round 1's ask or the owner's ruling, and the amendments agree with the tests.
- [x] **Code points.** I scanned `src/` and `test/` (1,141 text files) by code point. The scan looked for format characters (`\p{Cf}`), C0 and C1 controls other than tab, LF and CR, U+00A0, U+2028 and U+2029.
  - **Text-direction controls:** only the older U+202E at `test/dictionary-resync-concept.test.js:253`, as the test plan and the new ledger row say.
  - **The rest of the wider scan:** this round's brief expected that line alone, which holds for text-direction controls only. Seven more lines hold U+200B or U+200D: emoji sequences, a zero-width space that keeps `*/` from closing a comment, and a test input. They are `add-node-as-element-restore.test.js:116`, `:117` and `:128`; `author-scoped-inspection-roster.test.js:55`; `author-scoped-inspection-views.test.js:57`; and `dictionary-wired-create.test.js:213` and `:223`.
  - **All eight lines are older than the story:** each was last changed in a commit inside the base, `0b1d2a26`.
  - **Clean:** nothing flags in `src/`, in the story's eleven test files, in the round's seven other changed files, or in this review.
  - **CN2's input:** the case that displayed as `'a   b'` held a raw U+00A0 at `52ca6e8a` (line 48). It is now the same input, written as an escape.
- [x] **The merge with staging,** recorded at the coordinator's request:
  - **The tip moved.** `origin/staging` moved during this review, from `33c5ce2f` to `18b5db81`: another session fetched into the shared refs. Against either tip, `git merge-tree --write-tree origin/staging HEAD` conflicts in one file only, `test/helpers/nodeCypherFake.js`.
  - **The cause.** The conflict has two hunks: the doc comment and the function allowlist. Staging's `b0355996` (graph-operations-foundation #8) added `labels`, `elementId` and `id` where this branch added `toLower`. The evaluate lines merge cleanly.
  - **A trial resolution,** by union, in a scratch copy of the merge tree: the operations gate gives 384/0/0, exit 0, with this story's suites unchanged.
  - **Staging's other code changes** since the base touch neither CC2's oracle, `handleCreateConcept` (staging's one `normalize` hunk is in `handleApplyEnumerations`), nor the reinstall's wiring and pruning in `src/firmware/install.js`. Its derive-step changes are reads by element id, with no new write. So CC2 and Amendment 2's table stand.
  - **Not run:** staging's `test/pass-3-finishes-in-minutes.test.js`, the other user of the fake's new functions, because it calls `docker exec`.
  - **Not resolved here.** The coordinator resolves the conflict in a merge commit after this round, and re-runs the gate on it.
- [x] `bash scripts/harness-lint.sh`: clean, 0 violations, after this section and the story's close-out were written.

### Round-1 findings, re-checked

| Round 1 | Disposition | Check |
|---|---|---|
| **Blocking 1**: a rename of a `names` tag with no plural | Fixed | `_concepts.js:693-701`. A tag whose `value` is the old singular, and whose `value1` is the old plural or absent, holds the old names. It gains a `value1` only when the plural changes. I traced four shapes: no plural and a new singular (UC8's: the tag takes the new singular and still has no plural); no plural and a new plural (the tag gains it); a tag with a plural; and a hand-edited tag (kept). Decision 4 then reads the new singular from the tag, and the plural from the JSON, which the rule rewrites too. So the same call again answers `unchanged` with `change: null`. UC8 pins it, it is red at `52ca6e8a`, and both mutations fail it. The shape is in update-concept's seed (`update-concept.test.js:63-67`), in the Tester's commit, as asked. |
| **Blocking 2**: raw text-direction controls | Fixed | `conceptNames.js:25` writes the range with escapes, as `conceptHeaderEdit.js:45` does. The tests' strings are escapes (`create-concept.test.js:118`, `concept-names.test.js:56`). The scan above confirms it. |
| NB1: refusal order | Fixed | `anyBadInput` (`_concepts.js:132-137`) asks of each input exactly what `cleanInputs` (`:109-126`) refuses. So whenever a guard gives no item, `apply` refuses before the lock, and no input can skip the rule and still write. CC20 and UC9 pin it, red at `52ca6e8a`. Keeping `firmware-concept` after `slug-in-use` is fine. But Amendment 3.2's reason, "The Decisions order no two graph refusals", is loose: Decision 9 puts the rule's re-check at step 2 and `firmware-concept` at step 3, which is the order the code keeps. |
| NB2: a name in another script | Fixed | `conceptNames.js:81` names a–z, 0–9 and the dropped accents, which is what `dtag.slug` keeps (`src/lib/dtag.js:23-29`). CN3 and CC11b pin it. The Loom memo on A10.39 is the session's account: this review can't read Loom. |
| NB3: format characters | Fixed for format characters | `\p{Cf}` is refused, except the two joiners, naming its code point (`conceptNames.js:29`, `:78-79`). A joiner is refused at an end, or beside white space, a–z or 0–9 (`:31`). Round 1's suggestion named format characters, and the fix follows it. The probe shows that set is too narrow for the goal both state (R2-1). |
| NB4: the re-check after the lock | Filed | L7 in the test plan, and the story's known limits. Acceptable: the fake has no concurrency. |
| NB5: a rename onto a name-keyed name | Fixed, by the owner's ruling | `update-concept.js:85-88`, after the old check. `nameKeyed` is given the lowercased derived singular, and its list is lowercase (`conceptHeaderEdit.js:38-42`), so a typed `  Tapestry   Owner Goal ` is caught (UC10, red at `6fecadd1`). AC7, Amendment 3.6, `NAME_KEYED`'s `when`, the declaration's description and the catalog row agree. The ruling itself is the session's account. Leaving create-concept as it is matches today: only the Dictionary's edit calls `nameKeyed` (`src/api/adoption/editConcept.js:131`, `:138`), and no create path does. |
| NB6: the ledger's cause | Fixed | The ledger now calls the cause suspected, says what doesn't fit, and asks whoever fixes pass 1e to re-derive it. The test plan asks for L3 again. I re-derived the conflict rather than trust my own round-1 sentence. Amendment 2 wires each new superset into both `superset` and `set`, so the two-step path through set's superset exists for each of them. Yet the test plan's Verification 5 has those memberships surviving both reinstalls. |
| NB7: counts | Fixed, though no test pins it | `create-concept.js:105-114` and `update-concept.js:142-144`. Both compare numbers on Neo4j too: the seam's `toJS` turns a driver Integer into a number (`src/lib/neo4j-driver.js:157-158`, through `src/operations/graph.js:19-25`). See R2-3. |
| NB8: three reads per create | Filed | A Loom memo, by the session's account. No code change, as asked. |
| NB9: test gaps | Fixed | CC18 and CC19. Both pass at `52ca6e8a` too: they pin what round 1's probe saw work. |
| NB10: C3's label | Fixed | `_concepts.js:588` names `NostrEvent|TapestryNode`, as C3 does. Both labels have a uuid index (`setup/neo4jConstraintsAndIndexes.sh:45`, `src/lib/tapestry-node-index.js:15`). Whether the planner uses them for the disjunction is still not checked with `EXPLAIN`. |
| NB11: the older raw U+202E | Filed | `ledger/2026-11-16-raw-bidi-control-in-resync-test.md` is accurate, and its fix shape warns about tools that turn an escape into the character. Its date is the UTC one: the commit was made at 19:48, UTC−5. |
| NB12: near-match order | Nothing to do | As ruled. |
| Harness friction 1 | Done | The eighth occurrence is in `ledger/2026-10-07-on-pass-heading-reads-as-verdict.md`. |

### Spec, ADR and concept graph

- **Spec.**
  - AC6 now holds for a `names` tag with no plural (UC8), and AC7's ruled bullet holds (UC10).
  - AC5's approved list holds. So does the longer one in the Deviations, for format characters (R2-1).
  - The other criteria are as round 1 found them, and their tests pass.
- **ADR.**
  - Amendment 3's six items match the code, as do the marks it adds to Decisions 2 and 9. The exceptions are 3.2's one sentence (above) and 3.3's framing (R2-1).
  - There is no new dependency, and every read and write still goes through `ctx.tx`.
- **The new records.** The story's new Deviations match my runs and reading. So do the test plan's rows, its edge cases, L7, "L3 again" and its three run records. The joiner sentence is the exception (R2-1).
- **Concept graph and house rules.**
  - No handle, concept definition or firmware changed, so no reinstall is needed.
  - The TA is never hardcoded, and no `LEGACY_*` constant is touched.
  - No tooling was added. The added lines hold no debug output, no TODO and no 64-hex literal.
- **Invariants.** Unchanged since round 1. The new refusals concern the names an owner or admin types, and renames of this instance's own concepts. Nobody's publishing is gated.

### Findings

#### Blocking

None.

#### Non-blocking

1. **R2-1. `src/lib/conceptNames.js:29-31` and `:78`: other invisible characters still give round 1's case.** The check refuses format characters, but not every invisible character. The probe ran on HEAD's code, cleaning each name and then checking it, as `cleanInputs` does:
   - **Two characters outside `\p{Cf}`.** `bea` + U+FE0F + `gle` (a variation selector, category Mn) and `bea` + U+3164 + `gle` (a Hangul filler, Lo) are accepted, with the slug `bea-gle`. That is round 1's case: a name that reads as beagle, which neither the repeat nor a near match finds.
   - **A joiner between two accented Latin letters** is accepted, and it splits the slug. `caf` + U+00E9 + U+200D + U+00E9 gives `cafe-e`, beside `cafee` without the joiner. The Vietnamese người, with a joiner between its two marked vowels (U+01B0 and U+1EDD), gives `ngu-oi`, beside `nguoi`. The rule looks at a joiner's neighbours before `dtag.slug` drops their accents.
   - **The wrong code point.** When a joiner a script needs comes before a stray one, the refusal names the first (U+200C), not the stray one (U+200D).
   - **Records that claim more.** The records hold for "an invisible formatting character", but three of them claim more than the code does:
     - Amendment 3.3 says the list now covers "a name that reads as another".
     - The story's Deviations say the joiners are "allowed between two characters of a script that needs them".
     - The test plan says "a zero-width joiner beside a Latin letter" is refused, which holds for a–z only.
   - **Why it doesn't block.** AC5's approved list holds, and only the owner and admins can make a name.
   - **A follow-up could do any of these:**
     - test `\p{Default_Ignorable_Code_Point}` in place of `\p{Cf}`, keeping the joiner exception (Node 24 supports it, and it covers U+FE0F, U+3164, U+034F and both joiners);
     - test a joiner's neighbours after their accents are dropped, and name the stray joiner;
     - or make the three records say format characters.
2. **R2-2. `src/operations/catalog/graph/_concepts.js:98`: `bad-name`'s published `when` still lists only round 1's problems.**
   - This text is what `/docs` (`src/operations/openapi.js:50`), the command's help (`src/operations/cli.js:65`) and the operations list publish. So neither operation's published refusals name the invisible formatting character.
   - The catalog's create-concept row (`docs/GRAPH_OPERATIONS_CATALOG.md:62`) omits it too, and has never named text-direction controls.
   - Each is a one-line fix.
3. **R2-3. Two of the round's checks are pinned by nothing.**
   - **The stray-joiner rule's end and white-space parts.** With the end anchors removed, or white space dropped from the neighbours, every suite passes. CN3's one end case, a zero-width non-joiner before `beagle`, is also caught by its a–z neighbour. Two cases would pin these parts, a joiner at the end after a Persian letter and one after a space. The probe shows HEAD refuses both.
   - **The two count checks (NB7).** They are right by inspection, and no seed reaches them.

### Harness friction

1. **None new; two known ones recurred.**
   - `npm run gate:status` can't be quoted on this Mac.
   - The trap in ledger `2026-10-07-on-pass-heading-reads-as-verdict`: this round puts its close-out above its verdict, so no heading or bold line after the verdict holds a verdict word.

### Close-out (this commit)

- The story's status line now reads `Done`, and its Review link is filled in. Its criteria's boxes stay as they are, as on the other Done stories in this book.
- **Completion detection.** The book `graph-operations-first-slice` doesn't look complete, since every bullet of its frame is still open:
  - the foundation and the backup;
  - the rebuild (A10.39), which needs operations not yet built;
  - the ledger and the race;
  - reads behind sign-in.

  No close is offered.

### Verdict (round 2)

**PASS**

Both blocking findings are fixed and pinned. Each non-blocking one is fixed or filed acceptably. The tests fail before the fixes and pass after them, the mutations that matter make them fail, and every stack-free gate is clean. The three new findings are follow-ups. Before this reaches staging, the conflict in the fake must be resolved in a merge commit and the gate re-run on it, as the coordinator plans.
