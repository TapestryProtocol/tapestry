# Review: Story 19 — `graph enumerate`, `graph unenumerate` and rule 10 `enumerated-value-allowed`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-19
**Diff:** `git diff 9f1b4818..21a9df06`: 38 files, +3812 −55. `9f1b4818` is staging's head when the branch was cut, and `origin/staging` is still there as last fetched (no fetch was made). The range holds five commits:
- `10822630`: the story and the epic's entry;
- `c708e530`: ADR 0019 (Option A, accepted) and the story's four amendments;
- `aa92a4ca`: ADR 0019 Amendment 1 (the five new refusals are 409; `format` never refuses a reference) and the story's line for it;
- `3a3b3882`: the test plan, the four new suites, the seed `test/helpers/enumerationGraph.js`, the fake graph's `ENUMERATES` and `UNWIND`, and the changed suites;
- `21a9df06`: the implementation, rulebook entry 10 and its firmware element, the catalog rows, BIBLE §6 and §29, ADR 0018's note, the two ledger rows, and the story's Deviations and Evidence.

**Against:**
- the story, [19-enumerate.md](../../stories/graph-operations-first-slice/19-enumerate.md), as amended at Architecture and at Test Design;
- [ADR 0019](../../decisions/graph-operations-first-slice/0019-enumerate-and-unenumerate.md), Decisions 1–14 and Amendment 1;
- the [test plan](../../stories/graph-operations-first-slice/19-enumerate.test-plan.md), and the live-check record in the ignored `tmp/live-check-19/`, read only (`keys.json` and `backup.tar` weren't opened).

**How it was made.** A reviewer agent with no Edit access wrote this review at the session's request.
- It ran every suite itself, stack-free: stub `curl` (exit 7) and `docker` (exit 1) first on `PATH` through `tmp/a10-19-test-design/env.sh`, every service endpoint dead, and `TAPESTRY_CONTAINER_PORT` unset. It never ran `npm test` or docker. It made no call to the local stack, any network endpoint, GitHub or Loom.
- Its breaks, its probe tests and the red-before-green run used `git archive` copies under the ignored `tmp/review-19/`: three of `21a9df06` and one of `3a3b3882`. Its two helper probes (`probe-pieces.js`, `probe-null-item.js`, there too) only required the worktree's modules. `git status` in the worktree was clean after each.
- The session's brief limited it to this file and its own probes. So it doesn't commit, and it leaves the story's status alone (see "On PASS").
- The independent check before the commit (workflow 5, P13) wasn't applied.

**Verdict:** PASS, with six non-blocking findings.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`) was not run. On this Mac the local stack is the owner's live agent-memory instance (`tapestry`, localhost:7778), and the full suite writes to it. CI's Test / stack-free job runs it on the pull request.
- [x] **The scoped gate** at `21a9df06`, through the gate engine, with CI's five entries for an operations change: `operations.test.js`, `external-cli`, `openapi-coverage`, `admin-action-sweep` and `schema-save-finds-the-right-header`. Its `npm run gate:status -- --label a10-19-review-r1` line, with the path shortened:

  ```
  20261119T132752Z-49932-4dc5 [a10-19-review-r1] started 2026-11-19T13:27:52.673Z on 21a9df06+dirty — PASS, exit 0, 1263 passed, 0 failed, 6 skipped, 5/5 suites · …/tmp/gate-runs/20261119T132752Z-49932-4dc5.json
  ```

  - **The `+dirty` is the gate's own `node_modules` link and nothing else.** `git status --porcelain` held no entry before the link was made, only `?? node_modules` while it existed, and none after it was removed. The link is the known worktree gap (ledger rows `2026-11-16-worktree-node-modules-link-untracked` and `2026-11-16-route-walk-needs-node-modules`).
  - **By suite:**
    - operations: 1162 passed, 4 skipped;
    - external-cli: 53;
    - openapi-coverage: 13;
    - admin-action-sweep: 9;
    - schema-save-finds-the-right-header: 26, 2 skipped.

    The six skipped are live tests: LK1–LK4, L1 and L2.
  - **The operations run** holds this story's suites, all passing: enumerate 29, unenumerate 17, the rule's 16 and the agent's XN1. It holds the changed and neighbouring ones too: create-element 38, update-node 46, add-to-concept 60, the fake graph 33, mark-field 16, relationship-type-allowed 10, element-fits-schema 11.
  - **The total is the Implementer's.** Record `20261119T051821Z-40550-80a1` gave 1263/0/6, on `3a3b3882` with the implementation not yet committed (`dirtyCount` 20).
- [x] **Each suite the plan names, run alone** at `21a9df06` (pass/fail/skipped):

  | Suite | Result | Suite | Result |
  |---|---|---|---|
  | enumerate | 29/0/0 | mark-field | 16/0/0 |
  | unenumerate | 17/0/0 | relationship-type-allowed | 10/0/0 |
  | enumerate-agent-through-cli | 1/0/0 | graph-fake | 33/0/0 |
  | enumerated-value-allowed | 16/0/0 | graph-rule-firmware | 13/0/4 (live) |
  | create-element | 38/0/0 | firmware-element-sync | 21/0/0 |
  | update-node | 46/0/0 | graph-rules-builder | 26/0/0 |
  | add-to-concept | 60/0/0 | element-fits-schema | 11/0/0 |

  Each matches the story's Evidence.
- [x] **`node src/firmware/graph-rules.js --check`:** `graph-rules: the 10 items in firmware/active/concepts/graph-rule/elements are current.`
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)`, run before this file existed. For L1 once this file is in, see "On PASS".
- [x] **Red before green.** On `3a3b3882`'s tree, extracted, every count is the plan's Verification:
  - enumerate 0/29, unenumerate 0/17, the agent 0/1, the rule 0/16;
  - create-element 33/5 (CE14, CE50–CE53), update-node 41/5 (UN11, UN50–UN53), add-to-concept 56/4 (AT19, AT70–AT72);
  - mark-field 15/1 (MF15), relationship-type-allowed 9/1 (R2), graph-fake 33/0;
  - graph-rule-firmware 12/1, 4 skipped (GF9), firmware-element-sync 20/1 (IS8), graph-rules-builder 21/5 (GB2–GB6).
- [x] **The phases kept to their own files:**
  - `git diff 3a3b3882 21a9df06 -- test` is empty, so the implementation changed no test;
  - `git diff aa92a4ca 3a3b3882 -- src firmware docs BIBLE.md ledger` is empty, so the test phase changed no code or doc;
  - `git diff 9f1b4818 aa92a4ca -- src test firmware` is empty.
- [x] **The merge.** `origin/staging` is still `9f1b4818`, the branch's base, so there is nothing to merge as last fetched.
- [ ] `npm run test:playwright` doesn't apply: there is no UI change.
- [ ] _Lint not configured — skipped._ _Typecheck not configured — skipped._ _Build not configured — skipped._

### Breaking the real code

The plan's W1–W15 were run against a throwaway reference. So 48 breaks were applied to this code, `21a9df06`, one at a time, each in a scratch copy, with the suites that judge it run alone and the file put back and compared after each. 36 failed tests:

| Broken | Failed |
|---|---|
| rule 10 from everyone's point of view (`enumerated-value-allowed.js:39`), or a value that doesn't count allowed (`_enumerations.js:308`) | EV4, EV6, CE50 (each) |
| allowed, or the values report, from everyone's point of view (`enumerate.js:127`, `:128`) | EN3; EN4 |
| rule 10's second read holds the superset's direct elements only (`_enumerations.js:137`) | EV5, CE51 |
| allowed holds the direct elements only (`:142`) | EN3 |
| rule 10's first read finds top-level fields only (`:121`) | EV8, CE50, UN52 |
| a key read whatever its case (`:39`) | EV2 |
| a `null` judged (`:286`) | EV7, CE51 |
| a list judged by its first item (`:287`) | EV6, CE50, EN7 |
| no lock in enumerate (`enumerate.js:86`) | EN12, EN14 |
| no `holdsReference` / no `acceptsReference` (`:95` / `:96`) | EN18, EN22 / EN19, EN22 |
| a set's link not counted as elsewhere (`:105`) | EN20, EN22 |
| a repeat links and records again (`:118`) | EN10, EN11, EN12, EN13 |
| a repeat drops commit's catch-up from its entry (`:117`) | EN13 |
| no `reserved-source` / a source with two supersets taken (`_enumerations.js:168` / `:171`) | EN21, EN22, EN27 (each) |
| a superset's or a set's refusal names no header (`:164`) | EN21 |
| `enumeration-added` without `nodes` / without `concept` (`enumerate.js:121`) | EN2, EN5 (each) |
| `not-enumerable` declared 400 (`_enumerations.js:58`) | EN18 |
| `allowed.more` always false (`:338`) | EN15 |
| unenumerate takes out the first start's links only (`unenumerate.js:94`) | UE6 |
| its letters searched under the termination type (`:112`), or `relationshipEvents` ignoring `type` (`_memberships.js:520`) | UE5 (each) |
| no lock in unenumerate (`unenumerate.js:80`) | UE17 |
| unenumerate drops commit's catch-up (`:91`) | UE8 |
| update-node without rule 10 (`update-node.js:298`) | UN50, UN52, UN53 |
| update-node naming its first finding only (`:298`), or `checkRule` ignoring `every` (`_schemas.js:294`) | UN52 (each) |
| add-to-concept running rule 10 whatever the JSON (`add-to-concept.js:212–213`) | AT72 |
| add-to-concept without rule 10 (`:213`) | AT70, AT71 |
| create-element without rule 10 (`create-element.js:165`) | CE50, CE52, CE53, XN1 |
| rule 10's words without `graph resolve` (`_enumerations.js:438`) | EV14, CE50 |
| `value-not-allowed` declared 409 (`enumerated-value-allowed.js:27`) | EV1, EV16, CE14, CE50, CE52, CE53 |

Twelve failed nothing:
- **Four are gaps, each now probed** (non-blocking 3):
  - enumerate's `P.load` before its lock (`enumerate.js:86–89`);
  - unenumerate's links read before its lock (`unenumerate.js:86`);
  - rule 10 reading a link that starts at a set (`_enumerations.js:121`);
  - create-element running rule 10 before rule 4 (`create-element.js:164–165`).
- **Two are Deviations nothing pins** (non-blocking 3):
  - a repeat winning over `enumerated-elsewhere` (`enumerate.js:106`; Deviation 1);
  - the values report judging only the field just linked (`enumerate.js:128`; Deviation 3).
- **Two are left unpinned on purpose by the plan:**
  - unenumerate's `source` when the links have two starts (`unenumerate.js:104`);
  - `letters.searched` when nothing went (`:113`).
- **One changes only words.** A change entry or a tag taken as a node (`_enumerations.js:136`) is still refused, as "isn't an element of" rather than "names no node" (Deviation 7).
- **Three are defensive code the seed never reaches:**
  - two NostrUser rows for one author (`_enumerations.js:249`);
  - the MERGE's one-pair check (`enumerate.js:120`), which needs a superset deleted mid-call;
  - `values.judged` with an element whose JSON can't be read (`_enumerations.js:361`).

## Spec adherence

| AC | Evidence | Result |
|---|---|---|
| AC1, link a property to another concept | EN1–EN7, EN9, EN14, EN15; live S2–S4, L1a | Met |
| AC2, what a value is | EN3, EN7, EV2–EV7, CE51; live S3, S7 | Met (non-blocking 2: a `null` inside a list) |
| AC3, the writes check values, and they follow the source | CE50–CE53, UN50–UN53, AT70–AT72, EN4, EV8–EV14; live S4, S7, S8, L1c, L1d, L5c | Met |
| AC4, safe to repeat | EN10–EN13, XN1; live S5, L1b, L2a | Met |
| AC5, take the link back | UE1–UE8, UE16, UE17; live L1e, L5d | Met |
| AC6, what it refuses | EN16–EN23, UE9–UE12, each new code at its declared 409 (Amendment 1); live L1f, L5b | Met (non-blocking 1 and 5) |
| AC7, it lasts, and it reaches agents | EN24–EN26, UE13–UE15, XN1, CE14, UN11, AT19, EV15, EV16 and the three rule-list suites; live S6, L1, L3, L4, L6, L8 | Met |

- [x] **Every acceptance criterion has a passing test.**
- [x] **No criterion is silently dropped.** AC7's reinstall, restore, nginx and relay halves are live-only, as the plan says, and the record has them (checked below).
- [x] **No behaviour added that isn't in the story.** The refusals, the answers' fields and the report are the ADR's. The two judgment calls that go past it are in the story's Deviations (non-blocking 1 and 3).

## ADR adherence

- [x] **Decision 1, the link.**
  - `LINK` (`enumerate.js:30–33`) `MERGE`s `(a:Superset)-[r:ENUMERATES]->(b:Property)` and sets nothing on it.
  - The type is `K.rel().ENUM`, `relAlias('PROPERTY_ENUMERATION')` (`_concepts.js:80`).
  - EN1 checks the edge carries `{}`, and live L3a and L4a find all 17 links "carrying nothing" after a reinstall and a restore.
  - An edge that ends at a JSON schema node is never read. Rule 10's first read starts at a `Superset` and ends at a `Property` chained to the primary property (`_enumerations.js:120–127`). EN27, EV12 and UE16 check this, and so do live L3c and L4c.
- [x] **Decision 2's order is the code's.**
  - Steps 1–3: `requireInstalled` (`enumerate.js:83`), `conceptOfProperty` (`:84–85`), then the header's lock (`:86`), the call's first write (EN14).
  - Steps 4–6: `P.load` (`:89`), the caught-up tree's record, with the primary property answered `unknown-property` (`:92–93`), `not-enumerable` (`:95`) and `refuses-references` (`:96`).
  - Steps 7–9: the source (`:99`), the links in (`:103`), and `enumerated-elsewhere` (`:106–109`).
  - Steps 10–12: `P.commit` with the schema as it is (`:113`), the `MERGE` unless a repeat (`:118–122`), then `allowed` and `values` (`:126–128`).
  - The declared refusals (`:71`) are remove-property's list (`remove-property.js:84`), plus `unknown-concept` and the five new ones.
- [x] **Decision 3:** `sourceOf` (`_enumerations.js:160–173`).
  - `unknown-concept` with `input: source` covers a key that names no node or no header. For a superset or a set, the words name `EL.conceptsReaching`'s headers (EN21).
  - Then `reserved-source` on `EL.RESERVED_KEYS`, and `no-superset` unless there is exactly one.
  - Any author's header may be the source, firmware's included (EN9).
- [x] **Decision 4:** `holdsReference` (`:80–85`), and `acceptsReference` (`:92–96`) through `X.validatorOf`, rule 4's own compile.
  - A probe confirmed Amendment 1's point: `{ "type": "string", "format": "uri" }` accepts a reference, so a format never refuses one.
  - A list is tried with one reference. See non-blocking 1.
- [x] **Decision 5:** unenumerate (`unenumerate.js:77–83`) runs enumerate's steps 1–4.
  - It reads the links after the lock (`:86`), then commits (`:87`).
  - `UNLINK` takes out every copy from each start and counts them (`:28–30`, `:94–101`).
  - `relationshipEvents` gets `type: ENUM`, each removed start's address as `from`, the property's address as `to`, and `R.ownKeys()` as `authors` (`:110–113`). Its `type` defaults to `TERM` (`_memberships.js:520`), so `ownLetters` (`:540`), which passes none, is unchanged.
  - `SEARCHED` says the search covers only letters a reinstall has wired in (`_enumerations.js:513`).
- [x] **Decision 6:**
  - `REF` (`:39`) is lowercase 8-4-4-4-12, and a probe showed a leading space, a trailing newline or `Tapestry:` gives no key.
  - A field holding `null`, or left out, isn't judged (`:286`). For a `null` inside a list, see non-blocking 2.
  - A value is held when the source's class thread reaches it, through `IS_A_SUPERSET_OF*0..` then `HAS_ELEMENT` (`:137`). It counts by `R.trust('n')` from `R.resolvePov(read, 'owner')` (rule `:39`). That is list-elements' own test (`list-elements.js:147–157`), so `allowed` and the check count a node as list-elements does. EN3 compares `allowed` with list-elements' answer.
- [x] **Decision 7:** the rule's file, its `{ concept, json }` items and its two reads.
  - The first read is `FIELDS` (`_enumerations.js:120–127`), with each chain rebuilt through property nodes only (`:203–232`). Grok Bots' shape is found by its chain (EV9; live L5c).
  - The second read is one `UNWIND` (`:134–140`).
  - The finding is `{ item, concept, code, field, values, source, message }` (`:313–321`). Its message gives the field's place, each value and why, the source by name and key, and the three ways on, ending "Nothing changed." (`:434–439`).
  - The refusal is `value-not-allowed`, 400 (rule `:26–28`).
  - The two extra reads are Deviation 4. They don't grow with the items: EV13 compares the reads for 10 items and for 1.
- [x] **Decision 8:**
  - The guard with empty items is declared at `create-element.js:94`, `update-node.js:133` and `add-to-concept.js:93`.
  - Each write calls it right after rule 4: create-element at `:164–165`; update-node at `:297–298`, every finding named; add-to-concept at `:207–213`, inside its "the JSON changes" branch.
  - `checkRule` (`_schemas.js:287–296`) sits beside `checkElements`, which is unchanged.
  - Rule 10 takes no lock.
- [x] **Decision 9:**
  - `valuesReport` (`_enumerations.js:349–369`) judges `F.elementsOf`'s JSON, which lays `tapestryOwnSections` over the json tag as add-to-concept's view does. It reads at most 10,000 elements and names at most 50, in the ADR's shape.
  - `allowedOf` (`:331–339`) gives the first 50 by tapestryKey, counted to 10,001, with `more` (EN15; live L7a with 1,000).
- [x] **Decisions 10 and 11:**
  - The answers' schemas are at `enumerate.js:53–69` and `unenumerate.js:48–64`.
  - `enumeration-added` (`enumerate.js:121`) and `enumeration-removed`, one per start with `count` (`unenumerate.js:100`, Deviation 9), carry the keys `graph history` finds them by (EN5, UE3).
- [x] **Decision 12:** both writes lock the property's concept's header first. Live L2a ran 13 pairs of enumerates, 9 overlapping: each gave one link and one entry. Live L2b ran 5 enumerates beside a create-element: each element was made before the link or refused after it, never half of each.
- [x] **Decision 13:**
  - Rulebook entry 10 (`docs/GRAPH_RULES.md:158–167`) has the eight fields, `enforced`, the three writes and the ADR as its source.
  - Its element is current, by `--check` above. Live L3d found it among 10 items after a reinstall.
  - "Right after rule 7's" is right in the rulebook's own numbering, where `element-fits-schema` is rule 7.
- [x] **Decision 14:**
  - ADR 0018's note is at `0018-property-operations.md:354`.
  - The whole-value use of `tapestry:` is in BIBLE §29.
  - The memo on A10.34 is non-blocking 6.
- [x] **Amendment 1:** the five codes are 409 (`_enumerations.js:58–62`). `refusedAsDeclared` checks each against the operation's own listing (EN18–EN21). EN8 covers `format`.
- [x] **The Implementation notes' files are the diff's.** The shared edits are:
  - `_concepts.js`, `_memberships.js` (the `type` and the export), `_schemas.js` (`checkRule`), the three element writes;
  - `relationship-type-allowed.js:44–46`, whose words EN28 and R2 pin.
- [x] **The Deviations, each checked against the code:** all 14 hold as written. Non-blocking 1 is about Deviation 6, and non-blocking 3 notes that Deviations 1 and 3 are unpinned.
- [x] **No new dependencies.** `package.json`, `package-lock.json` and `clients/` are unchanged, so the agent's CLI is the one A10.6 shipped.

## Concept-graph integrity

- [x] **Handles:** none is written in code. The instance's own keys come at run time from `K.assistant()` (through `P.requireInstalled`) and `R.ownKeys()`. The diff adds no 64-hex literal and touches no `LEGACY_*` constant. GF11 finds no pubkey in the graph rule concept's files.
- [x] **Firmware reinstall:**
  - Not needed for the operations or the check.
  - Needed for rule 10's item in the graph rule concept. It is called out in ADR Consequences and in ledger row `2026-11-18-rule-nine-awaits-firmware-reinstall`, which now lists ten items.
  - No concept's definition changes.
- [x] **New code** reads the graph through the operations' helpers (`P`, `K`, `S`, `EL`, `F`, `R`), not by re-deriving from BIBLE.md.

## Things tests can't catch

- [x] **Cypher on Neo4j 5.26 Community.** Every new statement ran on Neo4j in the live check:

  | Statement | Live evidence |
  |---|---|
  | `SUPERSETS`, `LINKS_INTO`; `LINK` (the `MERGE`) | every enumerate: S2, S5, L1a, L1b, L2a, L7a; the `MERGE` in each that linked: S2, L1a, L2a, L7a |
  | `FIELDS` (rule 10's first read) | every element write: S7, S8, L1c, L3b, L4b; Grok Bots' chain in L5c |
  | `JUDGE` (the `UNWIND`, the `EXISTS` subquery, the trust fragment) | S7, with a key that names no node (a null `n`), the source's own header, and a peer below the cutoff |
  | `ALLOWED_READ`, `NAMES` | S3, L7a (1,000 elements); S4, the report naming "Old Name" |
  | `UNLINK`; `relationshipEvents` with `type` | L1e, L5d; L5d, which named the route's letter |

  - Not met on Neo4j: the refusals `not-enumerable`, `refuses-references`, `enumerated-elsewhere`, `reserved-source`, `no-superset`, `unknown-concept` for `source` and `unknown-property`, and unenumerate's `not-enumerated`.
  - Their reads are the statements above or reads older code already runs (`S.nodeOf`, `K.headersByKey`, `EL.conceptsReaching`, `CONCEPT_OF`), and the rest is JavaScript and ajv. So no live probe is asked.
- [x] **The live-check record, against its raw outputs:**
  - **The checks:** 34 pass, 25 in `main.log`, 6 in `reinstall.log` and 3 in `restored.log`, as the Evidence says.
  - **The code:**
    - The four new files' digests in `setup.log` are the first 16 hex digits of the committed files' sha256: `bcdaf607294cdc15`, `87e49fa99831b8b4`, `b36ecbca2f25d216`, `aa6605cc4e1c8d09`.
    - The firmware digest `d6d3385ebecb` is the committed `firmware/` tree's, computed here the way `setup.sh` computes it.
    - The seven other changed `src/` files weren't hashed. By their modification times, every one was last written by 05:12 UTC, before the control panel restarted at 05:43:29 UTC. The commit came at 05:54:40 UTC. That is evidence, not proof, that the check ran the committed code.
  - **The runs:** the 13 L2a and 5 L2b races, L7's timings, L8's 468 and 470 events, and the backup's counts (5,554 nodes, 6,116 relationships, an exact restore) match the Evidence.
- [x] **Concurrency.**
  - **The header's lock** puts enumerate, unenumerate, every property write and every element write on that concept in one line (live L2).
  - **The source isn't locked** (Decision 8), so a value can name an element deleted at that moment. `rules check` (A10.31) is the backstop the ADR names.
  - **Lock order.** Each write takes the property's concept's header first, and the `MERGE` then locks the source's superset and the property node, as creating a relationship does. The one inverse order is add-to-concept, or update-node, given a superset as its node, which it locks before refusing it (`add-to-concept.js:108–109`, `update-node.js:163`, `:185`). Neo4j detects such a deadlock and fails one of the two transactions. That is no practical risk, and no change is asked.
  - **A superset gone mid-call** fails the `MERGE`'s one-pair check, and the whole transaction rolls back, the catch-up with it (a 500 that asks to try again; Deviation 13).
- [x] **Security:**
  - `property` and `source` pass `N.keyInput`'s UUID pattern and reach Cypher as parameters.
  - Only firmware's relationship aliases, `P.MAX_DEPTH`, `COUNTED` and `reads.js`'s checked trust fragment go into a statement's text.
- [x] **Undeclared codes:**
  - Every refusal either operation can throw is in its declaration. `checkRule`'s `value-not-allowed` is declared through the guard (CE14, UN11, AT19).
  - The only other throws are a missing rule and the `MERGE` check, both 500s for what can't happen.
- [x] **No secrets in committed files**, and no `console.log`, `TODO`, `debugger` or commented-out code in the `src/` diff.
- [x] **No scope creep:** the diff is what the Implementation notes list, the story's record and the ledger rows.

## House rules check

- [x] **Concept Graph API authority respected.**
- [x] **No new lint/typecheck/build tooling.**
- [x] **The TA pubkey is never hardcoded.**

## Product-guide adherence

Not applicable: the story traces to no PRD.

## Findings

### Blocking

None.

### Non-blocking

1. **`src/operations/catalog/graph/_enumerations.js:92–96`, `:98–103`, `:383–394`: a list is tried with one reference, so `minItems: 2` is refused `refuses-references` in words that aren't true.**
   - Deviation 6 records the choice ("a list with `minItems` above 1 is refused `refuses-references` though two references would fit"). The refusal still says the schema "would refuse every reference: its schema leaves no tapestry:<tapestryKey> value it allows", and names nothing to take out.
   - AC6 lists only an `enum`, a `const`, a `pattern` or a length a value can't meet.
   - `refusingKeywords` knows those five keywords alone. So `maxItems: 0` and `not: { pattern: "^tapestry:" }`, rightly refused, are refused with the same unnamed words. A probe of `holdsReference`, `acceptsReference` and `say.refusesReferences` gave all three cases.
   - **Asked change, the owner's or the Architect's to choose:**
     - either try a list with `max(1, minItems)` references that differ, so `uniqueItems` passes too;
     - or keep the one-reference test and make the words true: name `minItems`, and say a list of two or more would fit.

     Either way, name each refusing keyword from ajv's errors on the sample rather than the fixed list, and record the choice as a Deviation or an ADR amendment.
2. **`src/operations/catalog/graph/_enumerations.js:286–292`: a `null` inside a list whose items allow `null` is refused, though the rulebook says a `null` isn't judged.**
   - Decision 4 lets `items: { "type": ["string", "null"] }` be linked, and Decision 6 doesn't judge a `null` "in a field whose type allows it".
   - A probe of the rule's check gave `{ "projects": [null] }` the finding "null isn't a reference". A `null` field and an empty list gave none.
   - `docs/GRAPH_RULES.md:160` (Says: "a `null`, and a field left out, aren't judged"), its firmware element and `enumerated-value-allowed.js:16` say more than the code does.
   - **Asked change, the owner's or the Architect's to choose:**
     - either skip a `null` item when the items' type allows one, and add the case to EV7;
     - or keep refusing it and narrow the rulebook and the comment to "a field holding `null`", then run `node src/firmware/graph-rules.js`.
3. **Four ADR points the suites don't pin, each now probed, and two Deviations nothing pins.** Four probe tests were added to scratch copies of the suites. Each passed on `21a9df06` and failed on its break:

   | Probe, added to | Pins | Fails on |
   |---|---|---|
   | EN14's transaction (`test/operations/graph/enumerate.test.js:388`): before the header's lock, only `requireInstalled`'s and `conceptOfProperty`'s reads | Decisions 2 (step 3) and 12 | `P.load` before the lock (`enumerate.js:86–89`) |
   | the same in UE17's (`test/operations/graph/unenumerate.test.js:324`) | Decisions 5 and 12 | the links read before the lock (`unenumerate.js:86`) |
   | the rule suite (`test/operations/rules/enumerated-value-allowed.test.js:62–66`, cases): a link from the flagship set into bot's `flag`, then `{ flag: 'not a reference at all' }` gives no finding | Decision 7 | rule 10 reading a link from any start (`_enumerations.js:121`) |
   | create-element's refused run (`test/operations/graph/create-element.test.js:806`): `{ project: 5 }` is refused `invalid-fields` | Decision 8, "right after" | rule 10 run before rule 4 (`create-element.js:164–165`) |

   - The third is an edge case the plan marks as covered: "[x] A link from a set, not a superset: … rule 10 never reads it" (`19-enumerate.test-plan.md:53`). No test checked it before the probe.
   - Deviations 1 and 3 pass every test when reversed (`enumerate.js:106`, `:128`). Pinning them is optional, since the plan left the report's per-field entries unpinned.
   - **Fix:** a Tester's change, adding the four assertions. None breaks an acceptance criterion as the code stands.
4. **`ledger/2026-11-19-property-writes-drop-enumerations.md:11`, `:13`: the row covers a retype, but a property write can also leave an enumerated field with no value that both rules accept.**
   - `graph update-property`, or `graph set-schema`, can give an enumerated property its own `enum` or `const`, or a `pattern` or a length that refuses every reference.
   - That is Decision 4's second test, which enumerate refuses at link time and nothing refuses afterwards: no write in `_properties.js`, `update-property.js` or `set-schema.js` mentions `ENUMERATES`.
   - Rule 4 then allows only what rule 10 refuses. ADR 0019's Consequences (`:164`) say the same as the row.
   - **Fix:** the row's "What was seen" and "Fix shape" name Decision 4's whole test (`holdsReference` and `acceptsReference`) as the guard's condition, not the type alone.
5. **`src/operations/catalog/graph/_properties.js:635–636`, `:657`: `P.load`'s refusals answer `input: concept` for enumerate and unenumerate, which take no `concept`.**
   - The story's Evidence notes it as "surprising, but within the ADR", and the plan leaves it unpinned. update-property and remove-property, which take `property` as well, answer the same.
   - An agent is told to fix an input it never sent, and no ledger row records it.
   - **Fix:** a ledger row, typed `bug`, whose fix shape has `load` take the input's name as it already takes `missing`, so all four name `property`.
6. **ADR 0019, Implementation notes ("Loom and the ledger"): the memo on A10.34 isn't recorded.** The notes ask for "a memo on A10.34, that `export nostr` must rewrite whole `tapestry:` values". The story's Deviations and Evidence and the commit message name the ledger row but no memo. Loom was out of this review's reach.
   - BIBLE §29 now says it ("has to rewrite whole values too"), so the point is in the repository.
   - **Fix:** the session writes the memo, or confirms it is there, and the story's Evidence names it.

### Harness friction

None new. The gate line's `+dirty` comes from the worktree's untracked `node_modules` link, which ledger row `2026-11-16-worktree-node-modules-link-untracked` already records.

## Verdict

**PASS**
- Every acceptance criterion has passing tests, and AC7's live half is in a record whose raw outputs match the story's Evidence.
- The code follows ADR 0019's Decisions 1–14 and Amendment 1, in order, through the property writes' load, lock and commit. Its shared-file edits are the ones the Implementation notes name.
- The scoped gate, each suite alone and the rule element's `--check` pass. harness-lint was clean before this file, and its L1 clears with the story's flip. Red before green matches the plan. 36 of 48 breaks of the real code are caught. Of the other twelve, four are probed gaps, two are unpinned Deviations, two are unpinned on purpose by the plan, one changes only words, and three are defensive code.
- The six findings are one refusal's untrue words for an edge case, one null-in-a-list choice, four unpinned points, a ledger row's scope, a ledger row not filed and an unrecorded Loom memo. None makes the operations wrong.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place, and its Review link filled in. This is left to the session: its brief let this review change no other file. harness-lint's L1 (a PASS review's story is Done) will flag this file until the flip lands with it in the review commit.
- [x] Completion detection performed. Its result goes in the chat, not this file.
