# Review: doc lane — the rulebook's entries gain status and source; graph-rules ADR 0001 marked Accepted

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-15
**Diff:** `git diff origin/staging...HEAD` on `docs/rulebook-status-and-source`: one commit, `b3be5011`, over `origin/staging` at `a282b2b7` (the merge of PR #75). The branch is local only. No remote branch contains `b3be5011`, and no PR is open for it.
**Lane:** doc lane (`engineering-team/workflows/0-intake.md` step 3: Implementer + Reviewer, non-numbered review, no story, no test plan, no book). This file is the lane's record.
**Intent audited against:** ADR `engineering-team/decisions/graph-rules/0001-graph-rules-tips-and-glossary-entries.md`, its Decision items 5–6 and its Implementation notes.
**Files:** `docs/GRAPH_RULES.md` (+10 −2), `engineering-team/decisions/graph-rules/0001-graph-rules-tips-and-glossary-entries.md` (+1 −1).

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh`: last line `harness-lint: clean (0 violations)`, exit 0. Every other line is a WAIVED or INFO entry for a file this change doesn't touch. Neither changed path is listed in `scripts/harness-def-paths.txt`, so L10 asks for no CHANGELOG row, and neither has a line budget in `scripts/harness-budgets.txt`.
- [x] Links: the diff adds no markdown links (no `](` in any added line). Every document the changed text cites exists: ADRs `graph-rules/0001`, `graph-operations-foundation/0003`, `0004` (Decision 12 at `:208`) and `0005`; `protocols/drafts/tapestry-concepts.md`; and design §7's "Where it lands" (`docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md:188`). The ADR's own three relative links still resolve.
- [x] `git diff --check origin/staging...HEAD`: no whitespace errors. The added lines contain no control bytes, and their only non-ASCII character is `§`. Both files still end with a newline.
- [x] Two tests read the rulebook: R10 (`test/operations/rules/relationship-type-allowed.test.js:249`) and FR14 (`test/operations/rules/field-mark-allowed.test.js:223`). A throwaway script re-evaluated their doc assertions by reading only `docs/GRAPH_RULES.md` and the design doc. Neither test file was loaded or run. All 23 checks hold. FR14 slices entry 3 to the end of the file, so its slice now includes the new Status and Source lines, and it still finds its six labels, its eight codes and the naming convention.
- [ ] `npm test`: **not run, on purpose.** On this machine the suite writes live to a real Tapestry instance that holds an agent's memory, and this change is docs only. `node test/gate-status.js` (the script behind `npm run gate:status`) prints `no gate run records in …/tmp/gate-runs` and exits 2, so there is no gate line to quote.
- [ ] Playwright: not applicable (no UI).
- [ ] _Lint / typecheck / build not configured: skipped._
- [ ] Independent checker (`workflows/5-review.md`, "Optional: an independent check before the commit"): not applied. This session has no way to start one. The session that commits this review can run one first.

## Claims adherence (doc-lane variant)

| # | Claim the change makes | Evidence | Holds? |
|---|---|---|---|
| 1 | Entry 1's Source is ADR graph-operations-foundation/0003 (`GRAPH_RULES.md:34`) | The entry's own line: "Built in story graph-operations-foundation #3 (ADR 0003)" (`:32`). ADR 0003 decides both enforcers: the rule `tapestry_key` (Decision 1, `:78`) and `keyNode` (Decision 8, `:176`). The code headers cite it (`src/lib/tapestry-key-cypher.js:3`, `src/operations/catalog/lifecycle/_migrations.js:3`). The design's status line credits "A10.3, ADR 0003; D6, §7's first rule". Story 3 is Done, and its review passed in round 3. ADR 0004 Decision 12 only *wrote* the entry; its list reads "the tapestryKey rule, built in A10.3" (`:217`). ADR graph-rules/0001 names 0003 itself (`:70`, `:80`) | Yes |
| 2 | Entry 1 is enforced (`:33`) | `CREATE CONSTRAINT tapestry_key IF NOT EXISTS FOR (n:TapestryNode) REQUIRE n.tapestryKey IS UNIQUE`, run by `lifecycle migrate --migration tapestry-keys` (`_migrations.js:156`). `keyNode` (`tapestry-key-cypher.js:22`), with `test/operations/lifecycle/tapestry-key-paths.test.js` checking that every path uses it. The entry's check: `lifecycle status`'s migrations part counts `withoutKey` and says whether the rule is in place (`src/operations/catalog/lifecycle/status.js:85–92`, `:144`, `:190`). The status describes the code. Whether a given instance has run the migration is what that check reports | Yes |
| 3 | Entry 2's Source is ADR graph-operations-foundation/0004 (`:52`) | The entry's own line: "Built in story graph-operations-foundation #4 (ADR 0004)" (`:50`). ADR 0004 Decision 6 is the rule (`:134`), with Amendment 1 (`SERVES`). The code header cites "ADR graph-operations-foundation/0004 Decision 6 and Amendment 1" (`src/operations/rules/relationship-type-allowed.js:3–5`), and that file names no other ADR. Story 4 is Done, and its review passed | Yes |
| 4 | Entry 2 is enforced (`:51`) | `relationship-type-allowed.js:131–137`: `refuses: true`, with refusals `undeclared-type` and `reserved-type`. Guards: `src/operations/catalog/graph/add-relationship.js:41` and `remove-relationship.js:42`. The write path runs every guard (`src/operations/write.js:32`) | Yes |
| 5 | Entry 3's Source is ADR graph-operations-foundation/0005 (`:74`) | The entry's own line: "Built in story graph-operations-foundation #5 (ADR 0005)" (`:72`). ADR 0005 Decision 5 is the rule (`:192`). The code header cites "ADR graph-operations-foundation/0005 Decision 5" (`src/operations/rules/field-mark-allowed.js:5`). Story 5 is Done, and its review passed | Yes |
| 6 | Entry 3 is enforced (`:73`) | `field-mark-allowed.js:57–70`: `refuses: true`, with eight refusals (three through shared constants, five written out). Guard: `src/operations/catalog/graph/mark-field.js:48`. `src/operations/catalog/graph/_fields.js` exists, as the entry says | Yes |
| 7 | All three rules are agreed, since "whether a rule is agreed is its source's status" | ADRs 0003, 0004 and 0005 each read `**Status:** Accepted` | Yes |
| 8 | New item: a status is "proposed (written, not yet enforced), enforced (its guard or check is built) or retired" (`:18`) | ADR Decision 6 (`:61`): the status "says whether code enforces it (proposed, enforced or retired)". The three values match. The gloss defines "proposed" as not enforced, not as not agreed, which keeps Decision 6's split between the two. The gloss for "enforced" names a guard or a check but not the database, which `:17` lists as a third enforcer | Yes, but one gloss is narrower (N3) |
| 9 | New item: the source is "the TIP or ADR that brought it in. Whether a rule is agreed is its source's status, not the rule's (ADR graph-rules/0001)" (`:19`) | ADR Decision 6, word for word, plus the citation | Yes |
| 10 | Status line: the rulebook holds "one entry per rule", now including, "since ADR graph-rules/0001, rules that are proposed but not yet enforced" (`:3`) | Three rules and three entries (`grep '^## '`). ADR Decision 6 adds the status `proposed`, and Consequences `:72` says rules "enter as proposed". Without this sentence the old status line ("It holds the rules that are built") would contradict the new value. The line doesn't mention retired entries | Yes, but retired entries are left out (N3) |
| 11 | Status line: "That ADR also says what may be written here and what goes elsewhere" (`:3`) | ADR Decisions 1, 5 and 7–9: a rule is a sentence a program can check; its wording lives in the rulebook; principles go in a TIP's text or in `design-philosophies/`; a rule about one concept stays in its JSON Schema; glossary entries stay in CONCEPTS.md. This sentence carries out the third Implementation note (`:82`) before the move that note is tied to | Yes, done early (N4) |
| 12 | Status line, wording kept from before: the quoted sentence is what "the design's §7 asks" (`:3`) | The quoted words are design §8, step 3 (`GRAPH_OPERATIONS_DESIGN_HANDOFF.md:196`). §7 (`:157`) says the same thing in other words and points to "§8, step 3" | No, wrong section (N2) |
| 13 | Status line, wording kept from before: the rulebook was started on 2026-11-14 by story graph-operations-foundation #4 (ADR 0004 Decision 12), and once ratified it moves under `protocols/` (design §7, "Where it lands") | The file was added in `e84018c9`, 2026-11-14, "impl: the-write-path (graph-operations-foundation #4, ADR 0004)". ADR 0004 `:208`. Design `:188` | Yes |
| 14 | The ADR is Accepted (`0001-…md:3`) | `:5`: "Its decider accepts it by merging it." `gh pr view 75`: MERGED into `staging` by `wds4` (`is_bot: false`) at 2026-11-16T01:53:52Z, merge commit `a282b2b7`. The PR body says "its decider accepts it by merging this pull request". The ADR template allows `Accepted` (`templates/adr.md:3`). Loom's decider field for A7.6 was not read from this session. The evidence is that a person, the repository owner, merged it | Yes |
| 15 | The Status line is the only change to the ADR | `git diff --stat`: 1 insertion and 1 deletion, in one hunk at line 3 | Yes |
| 16 | Commit message: each entry now says its status and source; the three built rules are enforced, from 0003, 0004 and 0005; the status line now allows proposed rules and points to the ADR | Rows 1–11 | Yes |

## ADR adherence

- [x] **Implementation note 1** (`:80`): Status and Source are added to "What each entry says" and filled in for the three entries: enforced, with ADR graph-operations-foundation/0003, 0004 and 0005 as their sources. Done in full, and it matches Consequences `:70`. The Source lines use the full `<epic>/<n>` form rather than the entries' short "(ADR 0003)". That is the right choice, because sources from another epic are about to arrive (N1).
- [x] **Implementation note 2** (`:81`), A10.41: correctly left out of this change.
- [x] **Implementation note 3** (`:82`): carried out early. See N4. It is justified, and the commit message says it was done.
- [x] **Beyond the notes:** the ADR's Status flip. It follows from the ADR's own acceptance rule (`:5`) and changes nothing else.
- [x] No code, dependencies or layering are involved. Decision 8's per-concept rules and Decision 9's glossary entries are untouched, as they should be.
- [ ] **Entries the notes didn't count:** see N1.

## Concept-graph integrity

- [x] No concept definition changes, so no firmware reinstall (ADR Consequences `:74`).
- [x] The handles already in the rulebook (`39998:<TA>:relationship-type`, `39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields`) keep the `<TA>` placeholder. There is no literal TA pubkey.
- [x] There is no new code, so nothing needs to orient via `/summaries`.

## Things tests can't catch

- [x] No secrets, no debug code, no code at all.
- [x] Markdown structure: each entry's new `Status` and `Source` items come after its indented paragraph (entry 1) or its last item (entries 2 and 3). They render as items of the same entry.
- [x] Architecture invariants: the two fields describe the code and the documents. They gate no publication and store no per-point-of-view result.
- [ ] **Open branches that write the same file:** see N1.

## House rules check

- [x] Concept Graph API authority: not engaged (no concept work).
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence

Not applicable: no PRD-traced copy.

## Findings

### Blocking

None.

### Non-blocking

1. **`docs/GRAPH_RULES.md`, end of file after `:74`: two open PRs add entries §4–§6 with no Status or Source.** PR #74 (`A10.16-create-update-concept`, tip `e10251ad`) adds §4 `concept-slug-unique`. PR #77 (`A10.28-link-unlink-set`, tip `ad625acf`) adds §5 `class-thread-acyclic` and §6 `set-has-a-parent`. Both target `staging`, and each branch's review parses as a PASS. Their ADRs are Accepted and set the old six-part form: graph-operations-first-slice/0016 Decision 14 (`:138`) and 0028 (`:278`, "the entry's six parts"). Graph-rules/0001's Implementation notes count only the three entries on `staging`. A three-way merge (`git merge-file` on copies of the file outside the repo) gives each branch one conflict with this change, just after entry 3's **Enforced by** line. So nothing merges silently. But a resolver who keeps both sides gets entries 4–6 without the two fields, and A10.41 reads its items from these entries (ADR Consequences `:69`). **Asked:** before merging, record the follow-up on #74 and #77 and in this branch's PR description (it has no PR yet), or as an OPEN.md row. Whichever of the three merges lands last should add the two fields. Each new rule file has `refuses: true` and a guard on its branch (`create-concept.js:63` and `update-concept.js:56`; `link-set.js:60`; `unlink-set.js:65`). So the values are Status: enforced for all three; Source: ADR graph-operations-first-slice/0016 for §4, and ADR graph-operations-first-slice/0028 for §5 and §6.
2. **`docs/GRAPH_RULES.md:3`: the quoted sentence is credited to design §7, but it is §8, step 3** (`docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md:196`). §7 (`:157`) paraphrases it and points there. The error predates this change. Review `graph-operations-foundation/4-the-write-path.md:161` named it on 2026-11-14 (non-blocking item 6). This commit rewrote the sentence and kept the error. **Optional:** "as the design asks (§8, step 3: "Write each rule …")".
3. **`docs/GRAPH_RULES.md:3` and `:18`: each new definition leaves out one case.** (a) The status line covers built rules and proposed rules. Decision 6 also allows `retired`, and a retired entry is neither. (b) "enforced (its guard or check is built)" names two of the three enforcers listed at `:17` and leaves out the database, which is entry 1's main enforcer. Entry 1 still counts as enforced under this gloss, through its built check, and Decision 6's own words are "whether code enforces it". Neither gap is wrong for any entry today. But A10.41 will turn these sentences into a concept's fields, so now is the cheapest time to make them exact. **Optional:** (a) "…and rules that are proposed or retired"; (b) "enforced (the database, a guard or a check enforces it)".
4. **`docs/GRAPH_RULES.md:3`: Implementation note 3 is carried out before the move it is tied to.** The note (`0001-…md:82`) says the status line names this ADR "when the rulebook moves under `protocols/`". The line names it now. That is earlier than the notes ask, but it is needed: once `proposed` exists, the old status line would contradict it. The commit message says so. **Optional:** nothing now. Whoever moves the rulebook should keep this sentence.
5. **Outside the diff, for the next writer.** (a) ADR graph-rules/0001 `:72` says design §7's three draft core rules "enter as proposed only if the owner keeps them". But the first of them is entry 1, which is already enforced; the design's status line calls it "§7's first rule". Read the sentence as covering the other two: the `tapestryValue` string, and one type per relationship. The ADR is accepted, so any fix would be an amendment by its decider. (b) Design §7 (`:157`) still says each rule is written into the rulebook "as its guard or check is built", and doesn't mention proposed rules. The ADR's notes don't ask for an update, so this change doesn't need one.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **OPEN.md row 80 again**: non-blocking findings in a passing review have no surface that sweeps them up. Review graph-operations-foundation/4's item 6 named `GRAPH_RULES.md:3` (the §7 credit) and `:43`, now `:47` ("the code" should be "the instance's server code (`src/`)"). Neither got a row. Both are still in the file, and the first was carried through this commit's rewrite of the same sentence. Record this as another occurrence on row 80, not as a new row.
2. **An ADR that changes a shared document's format has no step that checks the open branches writing to that document.** Graph-rules/0001's notes were scoped against `staging` while PRs #74 and #77 were adding entries in the old form (N1). Candidate `meta` row: the ADR template's Implementation notes, or the doc lane, could ask which open PRs write the file (`gh pr list`, plus `git log --all -- <file>`).
3. **`scripts/harness-lint.sh:111` reports every non-numbered review as one that "predates the numbering convention".** It says that about this review too. But 0-intake step 3 now makes the non-numbered form the convention for doc-lane reviews, so the message is wrong for every new doc-lane review. It is an INFO line, not a violation. Candidate `meta` row: reword it, for example "(non-numbered: a doc-lane review, or one from before the numbering convention; not matched to a story)". `scripts/harness-lint.sh` is a harness-definition path, so the change needs a CHANGELOG row.

## Verdict

**PASS**

Every claim the change makes holds against the ADRs, the stories, the code and GitHub. The one exception is the section number kept from the old status line (N2). Implementation note 1 is done in full, the ADR's only change is its Status line, the lint is clean, and every cited document resolves. N1 needs an owner before the last of the three merges.

## On PASS (same commit)

- [x] No story to mark Done: the doc lane has none (0-intake step 3).
- [x] Completion detection: none needed. A doc-lane change opens no book (0-intake step 4).
- [ ] Commit: left to the session that launched this review, which asked the Reviewer not to change git state. The role's rule is to commit the review whatever the verdict.
