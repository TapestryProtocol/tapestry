# Review: Story 20 — `graph create-element`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff ac491006...HEAD`, at `cf061f0e`.
- `ac491006` is staging's tip, which `cf061f0e` merged in with no conflicts.
- So the range holds the story's two commits:
  - `0d92f23d`: the test plan and the failing tests, approved at the Test Design gate;
  - `bf4a9108`: the implementation.

**How it was made.** The session that implemented the story had an independent reviewer agent write this review, so that the audit wasn't anchored on the implementation's own reasoning. Before committing it, the session checked both blocking findings against the sources:
- the derive step builds and validates `base` (`src/lib/derivers/word.js:42–66`, `:78–82`, `:122`, `:165`);
- firmware's `word` schema requires `word` and `graphContext`;
- the reviewer's probe of a concept keyed `word`, run again, stores `{"word":{"name":"Lexeme","slug":"lexeme","description":"a word"}}`.

It also checked the line references. Both findings hold.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`, which records the `npm run gate:status` line): not run here, so there is no local `gate:status` line for this diff.
  - **Why:** on this Mac the local stack is the owner's agent-memory instance, and the full suite writes to it (ledger row `2026-11-14-harness-points-tests-at-agent-memory`).
  - **Where it runs:** as the pull request's CI check.
  - **What only CI covers:** `test/operations.test.js` as a whole, and the route-surface suites (openapi-coverage, admin-action-sweep).
- [x] **Run by the Reviewer** on `cf061f0e`, one suite at a time, with every endpoint dead:
  - `NEO4J_URI=bolt://127.0.0.1:9`, `REDIS_HOST=127.0.0.1` and `REDIS_PORT=9`;
  - `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE` and `MEILI_URL_HOST` at `http://127.0.0.1:9`;
  - `TAPESTRY_PORT=9` and `TAPESTRY_CONTAINER=no-such-container`.

  All 18 suites pass, with the counts the Implementer recorded in the test plan:

  | Suite | Result line |
  |---|---|
  | `test/operations/graph/create-element.test.js` | 31 passed, 0 failed, 0 skipped |
  | `test/operations/graph/element-schemas.test.js` | 8 passed, 0 failed, 0 skipped |
  | `test/operations/rules/element-fits-schema.test.js` | 7 passed, 0 failed, 0 skipped |
  | `test/operations/graph/elements-agent-through-cli.test.js` | 1 passed, 0 failed, 0 skipped |
  | `test/graph-rule-firmware.test.js` | 13 passed, 0 failed, 4 skipped (GL1–GL4, the live checks: no scratch container) |
  | `test/graph-rules-builder.test.js` | 26 passed, 0 failed, 0 skipped |
  | `test/firmware-element-sync.test.js` | 21 passed, 0 failed, 0 skipped |
  | `test/operations/graph-fake.test.js` | 26 passed, 0 failed, 0 skipped |
  | `test/operations/graph/fields.test.js` | 8 passed, 0 failed, 0 skipped |
  | `test/operations/graph/map-fields.test.js` | 12 passed, 0 failed, 0 skipped |
  | `test/operations/graph/mark-field.test.js` | 16 passed, 0 failed, 0 skipped |
  | `test/operations/graph/unmark-field.test.js` | 13 passed, 0 failed, 0 skipped |
  | `test/operations/graph/fields-agent-through-cli.test.js` | 1 passed, 0 failed, 0 skipped |
  | `test/operations/change-entry-fields.test.js` | 3 passed, 0 failed, 0 skipped |
  | `test/operations/write-path.test.js` | 13 passed, 0 failed, 0 skipped |
  | `test/operations/rules/field-mark-allowed.test.js` | 14 passed, 0 failed, 0 skipped |
  | `test/operations/graph/create-concept.test.js` | 23 passed, 0 failed, 0 skipped |
  | `test/operations/lifecycle/tapestry-key-paths.test.js` | 19 passed, 0 failed |

- [x] **`node src/firmware/graph-rules.js --check`:** "graph-rules: the 7 items in firmware/active/concepts/graph-rule/elements are current." (exit 0)
- [x] **`bash scripts/harness-lint.sh`:** clean (0 violations). The two new ledger rows carry their header fields.
- [x] _Playwright not applicable: no UI._
- [x] _Lint, typecheck and build not configured: skipped._

## Spec adherence

- [x] **Every criterion has a passing test.** The plan's coverage map, checked against the suites:
  - AC1: CE1–CE4, CE13.
  - AC2: CE5, CE6.
  - AC3: CE20–CE22, CE4, CE5–CE6, SC1–SC6.
  - AC4: CE7–CE10, CE12, and live L2.
  - AC5: CE11, CE23–CE28, CE30, CE31.
  - AC6: CE40.
  - AC7: EFS1–EFS7, CE14–CE16, and the three A10.41 suites.
  - AC8: CE13, CE14, CE29, CE41, XE1, and live L4–L8.
- [x] **Each of Decision 18's twelve refusals has a test that fails if it breaks:**
  - `bad-name`: CE25.
  - `bad-fields`: CE26.
  - `unknown-concept` and `no-superset`: CE23.
  - `made-elsewhere`: CE27, all eleven concepts.
  - `not-installed`: CE31.
  - `unknown-node`, `not-a-set`, `not-in-class-thread` and `no-free-address`: CE24.
  - `invalid-fields`: CE20–CE21.
  - `no-schema`: CE22, five reasons.
- [ ] **No criterion silently dropped.** One concept breaks two criteria: firmware's own `word`, whose key is `word` (Blocking 2).
  - Its element's JSON loses the word block AC1 asks for.
  - It can't take an element at all, though AC5 says a firmware concept takes one.
- [x] **No behaviour beyond the story.**
  - `made-elsewhere` is the ADR's addition, which the owner approved.
  - The two ledger rows are follow-ups that the ADR and the Deviations ask for.

The story's `## Deviations` were checked against the code, and each holds. The one about the image's firmware on the scratch stack was checked by reading `scripts/scratch-stack.sh:80`, which mounts `src/` only.

## ADR adherence

- [x] **The files match the Implementation notes:**
  - `_schemas.js`, `_elements.js`, `create-element.js` and the rule;
  - `_fields.js`'s `conceptsOfNodes`, with the mapping unchanged, as the field suites show;
  - `changes.js`'s three descriptions;
  - rulebook §7 with its element file, and the catalog's §2 row.
- [x] **The steps follow Decision 2's order** (`create-element.js`):
  - name, fields and assistant (:96–101), then the lock (:105), before any read (CE12);
  - the concept (:108–114), then where the element goes (:116–120);
  - the repeat (:122–140), then the address (:142–144);
  - the JSON and its length (:146–150), then the rule (:152–154);
  - nothing is written before the node (:156–167).

  The codes and statuses match Decision 18's table, and CE14 reads them off the listing.
- [x] **The repeat matches Decision 6.**
  - It finds this instance's own element, anywhere in the class thread, by its name lowercased or by the plain or nonced address. The plain address wins, then the lowest key (CE8).
  - `differs` names the name (case included), a set the element isn't directly in, and each field given that differs, compared as JSON (CE7).
- [x] **The node matches Decisions 8–10, 14 and 15:**
  - word-wrapper JSON with its keys in order (CE2, CE5);
  - the tags `d`, `name`, `z`, `n` for a set, and `json`, with no stamps (CE2 shows beagle's `b` pointer isn't stamped);
  - one `HAS_ELEMENT` (CE1, CE5);
  - the answer's shape and the change entry.

  Nothing signs: the spy saw nothing (CE13, CE29), and no new module requires a signer (CE41). The exceptions are a concept keyed `word` (Blocking 2) and integer-like keys (Non-blocking 1).
- [x] **Option A's shape holds.**
  - The write path is unchanged, and the guard's items are empty.
  - The rule runs in `apply` through `_schemas.checkElements`, and its refusal carries `rule`.
- [x] **No new dependencies.** ajv 8.18.0 was already installed, and `_schemas.js` and the derive step load the same copy.
- [ ] **Decision 11's premise doesn't hold** (Blocking 1).
  - The ADR says the derive step validates "the node's whole JSON" (fact 4, line 16).
  - So, it says, the derive step and this check "give one verdict" (Decision 11, line 128; Decision 17, line 173).
  - In fact the derive step validates a different document.

## Concept-graph integrity

- [x] **Handles are in `kind:pubkey:slug` form.**
  - The element's address is `39999:<TA>:<d>`, and rule 7's item joins `39998:<TA>:graph-rule`.
  - The TA comes from `K.assistant()` and is never a literal.
- [x] **The firmware reinstall is called out:** ledger row `2026-11-16-rule-seven-awaits-firmware-reinstall`, and the ADR's Consequences. create-element itself needs none.
- [x] **Orientation:** the ADR's concept counts come from `/api/concept-graph/summaries`.

## Things tests can't catch

- [x] No secrets, no literal pubkey, no debug logging and no commented-out code.
- [x] **Error paths.**
  - Every refusal comes before anything is written (CE30).
  - A write whose entry can't be recorded keeps nothing (CE32).
  - The two 500s, a header with no address and one with no key, are in the Deviations.
- [x] **Concurrency.**
  - Each transaction takes the lock on the concept's header first (CE12).
  - The live check's L2 made one Moth Cafe from two parallel creates.
  - One narrow gap, found by reading: Non-blocking 3.
  - A create racing an unlink-set of its set was also checked by reading. It ends in the state create-then-unlink gives, so it isn't a finding.
- [x] **Injection.** Every input reaches Cypher as a parameter. All that is interpolated is firmware's relationship aliases (`relAlias`), `_eventless.js`'s fixed labels and a constant tag list.
- [x] **Prototype pollution: none.**
  - `JSON.parse` and `Object.fromEntries` make own properties, and the `$schema` strip is a rest spread.
  - A probe ran `parseFields`, `elementJson` and `differsOf` in one process on fields holding `__proto__` keys, at the top and nested. `Object.prototype` was unchanged, and the keys were stored as own keys of the section.
  - One comparison blind spot remains: Non-blocking 2.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence

_Not applicable: the story traces to no PRD copy or design guide._

## Findings

### Blocking

1. **`docs/GRAPH_RULES.md:123` (the last sentence of §7's Says), its copy in `firmware/versions/v1.0.0/concepts/graph-rule/elements/element-fits-schema.json:15`, and `src/operations/catalog/graph/_schemas.js:8–12`.** Each says that this rule and the derive step's `parentJsonSchemas` "give one verdict". They don't. The claim comes from ADR 0020 fact 4 (line 16), Decision 11 (line 128) and Decision 17 (line 173).

   **What the derive step validates.** `src/lib/derivers/word.js` validates `base`, not the node's JSON:
   - `base` is the LMDB cache when that has a `word` block (:44). Otherwise it is the json tag, but only if the tag has a `word` block (:63). Otherwise it is `{}` (:75).
   - It fills in `word.slug`, `word.name` and `word.wordTypes` (:78–82).
   - It adds its own `graphContext` (:122) before `validate(base)` (:165).

   Both read the schema the same way: the `jsonSchema` section, `$schema` dropped, `new Ajv({ allErrors: true, strict: false })`, and LMDB references resolved. The document they check is not the same.

   **The probe.** The real `deriveWord` ran beside `_schemas.problemsOf`, on the same schema and the same JSON. Neo4j, the LMDB store and the resolver were stubbed.

   | Schema | JSON | Derive step | `_schemas.js` |
   |---|---|---|---|
   | firmware's `word`, `required: ["word", "graphContext"]` | a word block: slug, name, title, wordTypes | valid | doesn't fit: "`graphContext` is required" |
   | top-level `additionalProperties: false`, taking `word` and `beagle` | a beagle element as create-element builds one | invalid: "/ must NOT have additional properties" | fits |
   | today's create-concept shape | a beagle element as create-element builds one | valid | fits |

   - **Where they agree:** on the schemas the live check used (L5: create-concept's and firmware dog's).
   - **Where they split, both ways:** on firmware's own `word` schema, and on any schema that limits the JSON's top-level keys.
   - **JSON with no `word` block,** which today's create-element route writes: the derive step drops the node's JSON altogether. In the probe it reported firmware dog's `dog` section as missing from JSON that had one.

   **Why SC5 can't see this.** Its `DERIVE` (`test/operations/graph/element-schemas.test.js:47–54`) is a copy of the schema reading, and it validates the bare JSON. The plan calls it "the derive step's", in the coverage map's AC3 row and in Edge cases, "The dialect".

   **Why it blocks.**
   - The sentence is part of rule 7's definition, and firmware installs that definition into every instance's graph at the reinstall the new ledger row asks for.
   - `rules check` (A10.31) and the property operations' reports (A10.18) are told they can rely on it.
   - Review 41 blocked on a BIBLE paragraph that misdescribed the code.

   **Asked change.**
   - **The Architect:** a dated note on ADR 0020 that corrects fact 4, Decision 11 and Decision 17. It should say:
     - what the derive step validates;
     - when the two verdicts differ: a schema that requires or forbids `graphContext`, or one a node passes only with the derive step's `word` defaults;
     - whether that stands until the derive step calls `_schemas.js` (Decision 11's "move together");
     - what create-element does with firmware's `word` (see 2).
   - **The Implementer:**
     - rewrite the last sentence of §7's Says to say what holds. The first sentence stays, since GB3 reads it as the item's description;
     - regenerate the element file with `node src/firmware/graph-rules.js`;
     - correct `_schemas.js:8–12`;
     - add a ledger row for the divergence, pointing at A10.31 and A10.18.
   - **The Tester:** one of two:
     - narrow SC5's claim in the plan to what it compares, the schema reading;
     - or add a case run against the real derive step. The probe shows that stubbing its three modules is enough, so the case stays stack-free.

2. **`src/operations/catalog/graph/_elements.js:276–278` (`elementJson`): when the named concept's key is `word`, the concept's section replaces the word block.** `Object.fromEntries([['word', word], [key, section]])` gives both entries one key, and the section wins.

   **Who reaches it.** Any concept header keyed `word`:
   - firmware's own `word`. Its `oKeys.singular` is `word` (`firmware/versions/v1.0.0/concepts/word/concept-header.json`), and it isn't in `MADE_ELSEWHERE`;
   - another instance's firmware `word`, if the import brings one in;
   - another author's concept named "word".

   This instance can't make one with create-concept: firmware's `word` already holds the key (the rulebook's entry 4, `concept-slug-unique`, BIBLE §10's rule 10).

   **The probe:** the real catalog, over the fake graph.
   - **Firmware's `word`, with firmware's word schema** added as its JSON schema node:
     - every create is refused `invalid-fields`: "`graphContext` is required; `word.wordTypes` is required";
     - `graphContext` is a section only the derive step writes (Blocking 1), so no `fields` can supply it;
     - with `fields: {"wordTypes": ["word"]}`, the field lands in the word section, and "`graphContext` is required" is left.

     So a firmware concept that every instance has can never take an element, and the refusal asks for something no caller can give. AC5 says "A firmware concept takes one too".
   - **The same concept with a schema that takes any object:** `created`, with the stored JSON `{"word":{"name":"Lexeme","slug":"lexeme","description":"a word"}}`.
     - It has no word block naming it and no `wordTypes`, which AC1 and Decision 8 ask for.
     - The description at `create-element.js:34` doesn't hold for it.

   **The tests.** The fixture seeds `word` with no JSON schema node (`test/helpers/createElementGraph.js:31`). So CE22's `ns-word` (`create-element.test.js:464`) is refused `no-schema` at step 8, after the JSON was built, and no test sees the collision.

   **Asked change.**
   - **The Architect,** with the owner's approval: decide how create-element treats a concept keyed `word`, and write it into Decision 18 or Decision 8. Two candidates:
     - refuse it before the JSON is built, saying why. For firmware's `word`: every node is a word through its word block, and its schema requires the derived `graphContext`;
     - or define a merged shape.
   - **The Tester:** tests that fail first, for:
     - firmware's `word` with its real schema;
     - another author's concept keyed `word`, with a schema that takes any object.
   - **The Implementer:** the fix, and the sentence at `create-element.js:34` if it changes.

### Non-blocking

1. **`src/operations/catalog/graph/_elements.js:277–278`: integer-like keys break Decision 8's order.**
   - A JavaScript object lists integer-like keys first.
   - A probe with `fields: {"description": "x", "2": "two"}` stored the section as `{"2":"two","name":"Numbery","slug":"numbery","description":"x"}`.
   - A concept whose key is integer-like would put its section before `word`. A concept named "2024" has the key `2024`, since `toKeyName` keeps digits.

   No reader depends on key order. Optional: say so in Decision 8, or refuse such field names.

2. **`src/operations/catalog/graph/_elements.js:34` (`canon`): a `__proto__` key inside a value is lost.**
   - `canon` builds its sorted copy by assignment, so such a key sets the scratch object's prototype instead of being copied.
   - A probe made Nesty with `meta: {"__proto__": {"a": 1}}`, then repeated it with `meta: {}`. The repeat answered `differs: []`.
   - This isn't pollution: the assignment reaches only that scratch object.

   Optional: build the copy with `Object.fromEntries`.

3. **`src/operations/catalog/graph/create-element.js:105`: a race across two concepts.** Found by reading and not reproduced: the fake runs one transaction at a time.
   - Suppose link-set has put concept B's superset under A's.
   - A create in A with `set` set to B's superset can run at the same time as a create of the same name in B.
   - Each holds only its own concept's header lock, so neither sees the other's element, and B's superset ends with two elements of that name.
   - Run one after the other, in either order, they make one, since each repeat search covers B's superset.

   Optional: lock the target set too, or record this in Decision 7 as a known limit.

4. **`create-element.js:118`, through `_concepts.js:444–455` (C8b): a scan on the rebuild's hot path.**
   - `headersByKey` matches `(h)` with no label, so it can't use the index behind the `tapestry_key` rule, which covers `:TapestryNode` only (`_migrations.js:221`).
   - create-element calls it once per create, and the rebuild (A10.39) makes every element with it.
   - The statement is pre-existing and shared with create-concept, and its cost is unmeasured.

   Optional: `MATCH (h:TapestryNode)`, timed on a migrated stack first.

5. **`src/operations/catalog/graph/_elements.js:18`:** the module's index lists `describeElement(row, concept)`, but the function takes one object (`:287`).

### Harness friction

1. **Known, seen again:** the role file and the template ask for a local `npm test` and its `gate:status` line, which this Mac can't give (ledger row `2026-11-14-harness-points-tests-at-agent-memory`). No new row.

## Verdict

**CHANGES_REQUESTED**

**What holds.** The operation does what ADR 0020 decided, in its order and with its codes:
- the lock comes before any read;
- the repeat matches, and `differs` names what differs;
- the JSON and tags are those of the letter, with no stamps, one link, and nothing signed.

Every criterion and every refusal has a test, and all 18 suites the review ran pass. The live check's record covers what the fake can't: the race, a reinstall, the derive pass, a restore, nginx and the relay. Rule 7's entry and its firmware file are in step.

**What is asked.**
- **Blocking 1** corrects a claim in the rule's definition: that this check and the derive step give one verdict. The derive step validates the JSON with its own `graphContext` and `word` defaults added, and firmware's own `word` schema splits the two.
- **Blocking 2** fixes, or refuses with a reason, the one concept key that collides with the word block.

Both need an Architect note, and tests that fail first. The non-blocking items are optional.

## On PASS (same commit)

- [ ] _Not applicable: the verdict is CHANGES_REQUESTED, so the story stays `**Status:** Approved`._

## Round 2 — 2026-11-16 (HEAD bc9b9871)

**Diff:** `git diff ea2d42d5..bc9b9871`: the three commits after round 1's review (`ea2d42d5`).
- `0534b738`: ADR 0020 Amendment 1, approved by the owner at its gate;
- `a80dedd2`: the round-2 tests, approved by the owner at the Test Design gate;
- `bc9b9871`: the fixes.

Each fix was checked as a fresh claim, from commands, this review's own round-1 suggestions included (role step 10).

### Quality gates (round 2)

- [ ] **The full gate:** not run here, for round 1's reason (ledger row `2026-11-14-harness-points-tests-at-agent-memory`). It runs as the pull request's CI check, so there is no local `gate:status` line.
- [x] **Run by the Reviewer** on `bc9b9871`, one suite at a time, with round 1's dead endpoints. All 22 pass, with the counts in the test plan's round-2 record:

  | Suite | Result line |
  |---|---|
  | `test/operations/graph/create-element.test.js` | 33 passed, 0 failed, 0 skipped |
  | `test/operations/graph/element-schemas.test.js` | 9 passed, 0 failed, 0 skipped |
  | `test/operations/rules/element-fits-schema.test.js` | 7 passed, 0 failed, 0 skipped |
  | `test/operations/graph/elements-agent-through-cli.test.js` | 1 passed, 0 failed, 0 skipped |
  | `test/graph-rule-firmware.test.js` | 13 passed, 0 failed, 4 skipped (GL1–GL4, the live checks) |
  | `test/graph-rules-builder.test.js` | 26 passed, 0 failed, 0 skipped |
  | `test/firmware-element-sync.test.js` | 21 passed, 0 failed, 0 skipped |
  | `test/operations/graph-fake.test.js` | 26 passed, 0 failed, 0 skipped |
  | `test/operations/graph/fields.test.js` | 8 passed, 0 failed, 0 skipped |
  | `test/operations/graph/map-fields.test.js` | 12 passed, 0 failed, 0 skipped |
  | `test/operations/graph/mark-field.test.js` | 16 passed, 0 failed, 0 skipped |
  | `test/operations/graph/unmark-field.test.js` | 13 passed, 0 failed, 0 skipped |
  | `test/operations/graph/fields-agent-through-cli.test.js` | 1 passed, 0 failed, 0 skipped |
  | `test/operations/change-entry-fields.test.js` | 3 passed, 0 failed, 0 skipped |
  | `test/operations/write-path.test.js` | 13 passed, 0 failed, 0 skipped |
  | `test/operations/rules/field-mark-allowed.test.js` | 14 passed, 0 failed, 0 skipped |
  | `test/operations/graph/create-concept.test.js` | 23 passed, 0 failed, 0 skipped |
  | `test/operations/lifecycle/tapestry-key-paths.test.js` | 19 passed, 0 failed |
  | `test/operations/graph/list-relationships.test.js` | 26 passed, 0 failed, 0 skipped |
  | `test/operations/graph/resolve.test.js` | 22 passed, 0 failed, 0 skipped |
  | `test/operations/resolve.test.js` | 11 passed, 0 failed, 0 skipped |
  | `test/operations/graph/concept-names.test.js` | 5 passed, 0 failed, 0 skipped |

- [x] **The tests of the fixes fail first.** They were run on `a80dedd2`, the new tests over the code before the fix, extracted with `git archive` under `/private/tmp`:
  - create-element: 29 passed, 4 failed (CE14, CE17, CE30, CE33);
  - the rule: 6 passed, 1 failed (EFS6);
  - `_schemas.js`: 9 passed, 0 failed. SC9 passes there too, since it pins what the derive step already does.

  That matches the plan's round-2 record exactly.
- [x] **`node src/firmware/graph-rules.js --check`:** the 7 items are current (exit 0).
- [x] **`bash scripts/harness-lint.sh`:** clean (0 violations), with the three new ledger rows.

### Round 1's findings, checked again

| Round 1 | The fix | Checked by | Holds |
|---|---|---|---|
| Blocking 1, "one verdict" | Amendment 1, item 1; §7's Says and its element; `_schemas.js`'s header; SC5 narrowed; SC9; EFS6; a ledger row | the amendment's facts against `word.js`; the real derive step in probes; SC9 against a mutant derive step | In part: Blocking R2-1 |
| Blocking 2, the `word` key | `reserved-key` in step 3; CE33 and CE14; CE22 moved to `scroll` | the code, and a probe of three more keys | Yes |
| Non-blocking 1, key order | Amendment 1, item 3 | reading | Yes |
| Non-blocking 2, `canon` | `Object.fromEntries`; CE17 | CE17 fails on the old code and passes on the new | Yes |
| Non-blocking 3, the race | Amendment 1, item 3; a ledger row | reading: when every header that reaches the target is locked in one order, both creates lock A and B, so they run one at a time | Yes |
| Non-blocking 4, the scan | a ledger row | the row's two calls (`create-element.js:114`, `:124`), and create-concept's `nearMatches` and `describeConcept` | Yes |
| Non-blocking 5, the index line | `_elements.js:19` | reading `:303` | Yes |

### The six questions

1. **Does Amendment 1 say what the code and the derive step do?**
   - **What holds.** The derive step's sources and additions:
     - its `base` (`word.js:44`, `:63`, `:75`) and its `word` defaults (`:78–82`);
     - its `graphContext`, added before `validate(base)` (`:122`, `:165`);
     - the ten-link limit (`IS_A_SUPERSET_OF*0..10`, `:104`);
     - ConceptHeader only, for `h1` and `h2` (`:105`, `:107`);
     - the concepts a `z` tag names (`:106–107`).

     The rule's check form reads differently: every class thread, with no limit, ConceptHeader or ListHeader, and no `z` tags (`_fields.js`'s `conceptsOfNodes`).
   - **"So is every firmware schema but `word`'s."** This holds for an element whose word block has its slug, name and wordTypes:
     - all 83 firmware element files get the same verdict from both readers (probe);
     - only `word`'s schema mentions `graphContext`, and none limits its top-level keys.

     But under the amendment's own condition, "doesn't lean on the derive step's `word` defaults", `validation-tool`'s schema isn't one (Non-blocking R2-1).
2. **Does rule 7's new Says hold?**
   - Its first sentence is unchanged, so GB3 still reads it as the item's description (graph-rules-builder, 26 passed).
   - The element file is in step (`--check`).
   - The new last sentence doesn't hold: Blocking R2-1.
3. **Is `reserved-key` complete and in its place?** Yes.
   - **Where:** `create-element.js:114–115`. That is after `made-elsewhere` (`:110–111`), before `no-superset` (`:116–117`), and before the JSON is built (`:151–153`).
   - **The key it checks is the key the section is filed under.** One `header`, read at `:114`, is checked at `:115` and passed to `elementJson` at `:152`.
   - **Listed and tested:** in the refusals (`:86`; CE14), in CE33's four cases, and in CE30, whose refusal run includes them.
   - **No other path files a section under either key.** Only the named concept's section is written. Other concepts' keys go only into `wordTypes`, and `word` is filtered out there (`_elements.js:291`).
   - **A probe of three more keys:**
     - a header named "lexicon" whose `oKeys.singular` is `word`: refused `reserved-key`;
     - another author's "Graph Context" with no `oKeys`, whose derived key is `graphContext`: refused;
     - a key `Word`, with a capital W: created, with its word block intact and a separate `Word` section. JSON keys are case-sensitive, so nothing collides.
4. **Does SC9 run the real derive step, and would it catch a change?** Yes, to both.
   - It loads the real `src/lib/derivers/word.js` and stubs only its three dependencies.
   - A resolver redirect under `/private/tmp`, with the repository untouched, swapped in a mutant derive step that validates without its own `graphContext`. SC9 failed: "firmware word's schema: … got derive false". With the real step it passes.
   - It pins two of the ledger row's four splits, not the one for JSON with no word block (Non-blocking R2-5).
5. **Do the three ledger rows say what holds?**
   - `2026-11-16-headers-by-key-scans-unlabelled` and `2026-11-16-shared-set-creates-can-race`: yes.
   - `2026-11-16-derive-step-and-rule-check-split`: yes, with one gap in its list of splits (Non-blocking R2-2).
6. **Did the fixes break anything?**
   - No suite fails, and reading found nothing broken.
   - Reading the header in step 3 moves the 500 for a header with no key ahead of the set refusals, and changes nothing else.
   - There are two small text slips: Non-blocking R2-3 and R2-4.

### Findings (round 2)

#### Blocking

1. **The new agreement sentence leaves out two of Amendment 1's conditions, and fails where they matter.** It is at `docs/GRAPH_RULES.md:123` (§7's Says), in its copy at `firmware/versions/v1.0.0/concepts/graph-rule/elements/element-fits-schema.json:15`, and at `src/operations/catalog/graph/_schemas.js:13–17`.
   - **What it says:** "So the two verdicts agree under a schema that neither requires nor forbids `graphContext` and doesn't limit an element's top-level keys, as every schema create-concept writes does".
   - **What Amendment 1 says** (ADR 0020, `:275`): they agree "for an element with a word block", under a schema that also "doesn't lean on the derive step's `word` defaults". The owner approved that text, and the rulebook drops both conditions.
   - **The probe:** the real `deriveWord`, stubbed as SC9 stubs it, beside `problemsOf`.

     | Schema | JSON | Derive step | `_schemas.js` |
     |---|---|---|---|
     | create-concept's, as `todaysConcept` builds it | `{"beagle": {"name": "Max", "slug": "max", "description": "x"}}`: no word block | invalid: "/ must have required property 'beagle'" | fits |
     | firmware's `validation-tool` | `{"word": {"name": "checker", "wordTypes": ["word", "validationTool"]}}`: no `slug` | valid | doesn't fit: "`word.slug` is required" |

     Neither schema requires or forbids `graphContext`, and neither limits top-level keys. The first is one create-concept writes.
   - **Why it blocks:** for round 1's reason.
     - The sentence is part of rule 7's definition, which firmware installs on every instance.
     - `rules check` (A10.31) will judge elements with no word block under create-concept's schemas, which is where this sentence says the two agree. Today's create-element route writes such elements.
   - **Asked change.** This is for the Implementer; it needs no Architect or test step.
     - Make the sentence say what holds, in §7's Says and in `_schemas.js:13–17`. Either carry Amendment 1's two conditions into it, or scope it to what was checked: the JSON create-element writes, which always has a full word block. Then point at the amendment and the ledger row for the rest.
     - Keep the first sentence of Says, for GB3.
     - Regenerate the element file with `node src/firmware/graph-rules.js`.

#### Non-blocking

1. **ADR 0020 `:275`: "so is every firmware schema but `word`'s".**
   - Under the amendment's own condition, `validation-tool`'s schema leans on the derive step's `word` defaults: it requires `word.slug` and `word.wordTypes` (the probe above).
   - Dog's `if`/`then` rules read `word.wordTypes` too.
   - The claim holds for elements whose word block has its slug, name and wordTypes: all 83 firmware element files agree.

   Optional, for the Architect: scope the sentence to such elements.
2. **`ledger/2026-11-16-derive-step-and-rule-check-split.md:16–20`:** its list of splits leaves out a word block missing a field the derive step fills in, the `validation-tool` case above. Optional: add it.
3. **`engineering-team/stories/graph-operations-first-slice/20-create-element.md:91`:** "AC5's "a firmware concept takes one too" holds for every firmware concept but `word`".
   - It doesn't hold for the eleven `made-elsewhere` concepts either (Decision 4).
   - A scan shows every firmware schema requires only `word` and its own key, except `word`'s. So `word` and those eleven are all the exceptions.

   Optional: name the eleven too.
4. **ADR 0020 `:66` and `:180–191`.** Decision 2's step 3 has no pointer to `reserved-key`, and Decision 18's table has no row for it, though the amendment says the table "gains the row" (`:290`). The sentence under the table does point at Amendment 1. Optional: add a pointer at step 3, and either add the row or reword "gains" to say what was done.
5. **SC9 (`test/operations/graph/element-schemas.test.js`)** pins two of the ledger row's four splits. Optional: add a case with no word block under create-concept's schema, the probe's first row above.

#### Harness friction

1. Nothing new. The gate's friction is round 1's.

### Verdict (round 2)

**CHANGES_REQUESTED**

**What holds.**
- Blocking 2 is fixed completely. `reserved-key` refuses every concept keyed `word` or `graphContext`, in its place and before anything is built. It is listed and tested, and nothing else files a section under either key.
- Amendment 1's facts about the derive step hold against `word.js`.
- SC9 runs the real derive step, and fails when what it pins changes.
- The tests of the fixes failed first, as the plan records. SC9, which pins what the derive step already does, passes before and after.
- Round 1's five non-blocking findings are each fixed or recorded, and every suite passes.

**What is asked.** One sentence of rule 7's Says, and its echo in `_schemas.js`'s header, still claim agreement where the two readers split. Fixing it is the Implementer's work, since Amendment 1, which the owner approved, already states the conditions.

- [ ] _On PASS: not applicable. The verdict is CHANGES_REQUESTED, so the story stays `**Status:** Approved`._

## Round 3 — 2026-11-16 (HEAD e607aa61)

**Diff:** `git diff b761b09c..e607aa61`: the three commits after round 2's review (`b761b09c`).
- `9347aaad`: ADR 0020's edits. Decision 2's step 3 and Decision 18's table gain `reserved-key`, and Amendment 1's firmware claim is scoped, with a dated note;
- `66c80d37`: SC9's two new cases;
- `e607aa61`: rule 7's Says and its firmware element, `_schemas.js`'s header, the ledger row, the story's note and the plan's record.

Under `src/`, this round changes only `_schemas.js`'s header comment, so no running code changed. Each changed sentence was re-derived from commands, round 2's suggested scopes included (role step 10).

### Quality gates (round 3)

- [ ] **The full gate:** not run here, for round 1's reason (ledger row `2026-11-14-harness-points-tests-at-agent-memory`). It runs as the pull request's CI check, with the route-surface suites.
- [x] **Run by the Reviewer** on `e607aa61`, one suite at a time, with round 1's dead endpoints. All 22 pass, with round 2's counts:

  | Suite | Result line |
  |---|---|
  | `test/operations/graph/create-element.test.js` | 33 passed, 0 failed, 0 skipped |
  | `test/operations/graph/element-schemas.test.js` | 9 passed, 0 failed, 0 skipped |
  | `test/operations/rules/element-fits-schema.test.js` | 7 passed, 0 failed, 0 skipped |
  | `test/operations/graph/elements-agent-through-cli.test.js` | 1 passed, 0 failed, 0 skipped |
  | `test/graph-rule-firmware.test.js` | 13 passed, 0 failed, 4 skipped (GL1–GL4, the live checks) |
  | `test/graph-rules-builder.test.js` | 26 passed, 0 failed, 0 skipped |
  | `test/firmware-element-sync.test.js` | 21 passed, 0 failed, 0 skipped |
  | `test/operations/graph-fake.test.js` | 26 passed, 0 failed, 0 skipped |
  | `test/operations/graph/fields.test.js` | 8 passed, 0 failed, 0 skipped |
  | `test/operations/graph/map-fields.test.js` | 12 passed, 0 failed, 0 skipped |
  | `test/operations/graph/mark-field.test.js` | 16 passed, 0 failed, 0 skipped |
  | `test/operations/graph/unmark-field.test.js` | 13 passed, 0 failed, 0 skipped |
  | `test/operations/graph/fields-agent-through-cli.test.js` | 1 passed, 0 failed, 0 skipped |
  | `test/operations/change-entry-fields.test.js` | 3 passed, 0 failed, 0 skipped |
  | `test/operations/write-path.test.js` | 13 passed, 0 failed, 0 skipped |
  | `test/operations/rules/field-mark-allowed.test.js` | 14 passed, 0 failed, 0 skipped |
  | `test/operations/graph/create-concept.test.js` | 23 passed, 0 failed, 0 skipped |
  | `test/operations/lifecycle/tapestry-key-paths.test.js` | 19 passed, 0 failed |
  | `test/operations/graph/list-relationships.test.js` | 26 passed, 0 failed, 0 skipped |
  | `test/operations/graph/resolve.test.js` | 22 passed, 0 failed, 0 skipped |
  | `test/operations/resolve.test.js` | 11 passed, 0 failed, 0 skipped |
  | `test/operations/graph/concept-names.test.js` | 5 passed, 0 failed, 0 skipped |

- [x] **`node src/firmware/graph-rules.js --check`:** the 7 items are current (exit 0).
- [x] **`bash scripts/harness-lint.sh`:** clean (0 violations) before this section was added. With this section's verdict, its L1 check expects the story's status to be Done, which the session sets in the review commit.

### Round 2's findings, checked again

| Round 2 | The fix | Checked by | Holds |
|---|---|---|---|
| Blocking 1, the agreement sentence | `docs/GRAPH_RULES.md:123`, its element (`element-fits-schema.json:15`) and `_schemas.js:13–21`: scoped to an element whose word block has its slug, name and wordTypes | the real derive step beside the check, in a probe; reading `word.js` and create-element's write path | Yes, for what it now states. Two narrow cases it leaves unstated: Non-blocking R3-1 and R3-2 |
| Non-blocking 1, the firmware claim | ADR 0020 `:276`, scoped, with a dated note | round 2's probe of the 83 firmware element files, and its scan | Yes |
| Non-blocking 2, the ledger row | `ledger/2026-11-16-derive-step-and-rule-check-split.md:20` | `word.js:78–82`, and `validation-tool`'s schema | Yes |
| Non-blocking 3, the story's note | `20-create-element.md:91` | round 2's scan: every firmware schema requires only `word` and its own key, except `word`'s | Yes |
| Non-blocking 4, the ADR's pointers | Decision 2's step 3 (`:66`), Decision 18's row (`:184`), Amendment 1's "Who else" | the code's order (`create-element.js:110–117`) | Yes |
| Non-blocking 5, SC9 | two cases (`element-schemas.test.js:329–330`, `:340–343`) | a mutant derive step for each split | Yes |

### The six questions

1. **Does the new agreement sentence say only what holds?** For what it states, yes.
   - **"As every element create-element writes has" holds on every path that writes.**
     - `elementJson` gives the word block a slug `<concept slug>--<slug>`, a name `<singular>: <name>`, and wordTypes starting with `word` (`_elements.js:292`).
     - That JSON is the only one create-element stores (`create-element.js:152–153`, written in step 9).
     - A repeat writes nothing, and `reserved-key` keeps any section off the `word` key.
     - With such a block, the derive step's defaults (`word.js:78–82`) change nothing.
   - **"On each concept both judge" is right, read as each concept for which both give a fits verdict.**
     - The derive step judges each ConceptHeader whose class thread reaches the node within ten links, and each one a `z` tag names, once for each schema node (`word.js:102–117`).
     - The rule judges each concept whose class thread reaches the node. Where the derive step gives `valid: false` (a schema that doesn't parse or compile), or two verdicts (two schema nodes), the rule gives `no-schema`.
   - **The probe:** the real `deriveWord`, stubbed as SC9 stubs it. Under create-concept's schema, with a full word block and a fresh cache, both say the element fits.
   - **Two cases it leaves unstated,** both narrow:
     - a cache left stale by a json-tag edit (Non-blocking R3-1);
     - a schema that says something about `graphContext` without requiring or forbidding it (Non-blocking R3-2).
2. **GB3 and `--check`.** GB3's first sentence is unchanged: "an element's JSON fits the JSON schema of each concept it belongs to." graph-rules-builder passes 26, and the element's `word.description` didn't change. `--check` is clean.
3. **The ADR edits hold.**
   - Decision 2's step 3 (`:66`) names `reserved-key` after `made-elsewhere` and before `no-superset`, the code's order (`create-element.js:110–117`).
   - Decision 18's row (`:184`) gives it 409, as `_elements.js:59` does.
   - Amendment 1's claim (`:276`) is now scoped to a full word block, which round 2's probe of all 83 firmware element files and its scan bear out. The dated note says when the claim was scoped, and why.
   - "Who else" now says what was done.
4. **SC9 pins four splits, and each of its four assertions fails on its own when its split stops holding.** Each mutant derive step was swapped into the real suite by a resolver redirect under `/private/tmp`, with the repository untouched:

   | Mutant derive step | The split it removes | SC9 fails on |
   |---|---|---|
   | validates without its own `graphContext` | firmware `word`'s | "firmware word's schema: … got derive false" |
   | ajv's `removeAdditional`, on a copy of `base` | a schema that forbids extra top-level keys | "a schema that forbids extra top-level keys: … got derive true" |
   | keeps a json tag that has no word block | JSON with no word block | "JSON with no word block … got derive true" |
   | fills in no default slug | a word block missing a field the derive step fills in | "a word block with no slug … got derive false" |

   With the real derive step, SC9 passes.
5. **The ledger row and the story's note say what holds.**
   - The row's new split (`:20`) is the derive step's three defaults, with `validation-tool`'s `word.slug` as its example.
   - "Pins the first four of these splits" (`:23`) matches SC9's four cases.
   - The note (`:91`) names `word` and the eleven `made-elsewhere` concepts. Round 2's scan found those are all the exceptions.
6. **What the fixes broke, and what else blocks: nothing found.** The 22 suites pass, and the round changes no running code. `reserved-key` is the only refusal code of that name in the catalog.

### Findings (round 3)

#### Blocking

None.

#### Non-blocking

1. **The agreement also needs the derive step's cache to be current.** This applies to `docs/GRAPH_RULES.md:123`, `_schemas.js:13–21` and ADR 0020 `:276`.
   - The derive step judges its cached JSON when there is one with a word block (`word.js:44`). Nothing refreshes that cache when the json tag changes:
     - today's save-element-json (`regenerateJson`, `src/api/normalize/index.js:60`) and set-json-tag (`handleSetJsonTag`, `:4791`) re-sign and re-import, and leave the cache as it was;
     - only `src/api/strfry/tapestryBrainWrite.js:103` removes an entry before deriving;
     - `deriveByKey` and `deriveAll` (`src/lib/tapestry-derive.js`) don't, and the store has no bulk clear.
   - **The probe:** create-concept's schema, with a full word block in both documents. The json tag has lost its description; the cache still has it. The derive step says valid, and this check says "`beagle.description` is required".
   - **This is OPEN.md row 139,** open since 2026-08-05. The row says "Whether other write paths (e.g. `save-element-json`) hit the same staleness is unaudited". This round answers that: both routes do.

   Optional: point the ledger row (and the sentence, if wanted) at row 139, and add this answer to row 139.
2. **"Neither requires nor forbids `graphContext`" is narrower than what's needed.** This applies in the same three places.
   - A schema can split the two without requiring or forbidding `graphContext`: one that types it (`{"properties": {"graphContext": {"type": "string"}}}`), or one that keys a dependency on it. The probe gives the derive step invalid and the check fits, for both.
   - No firmware schema but `word`'s mentions `graphContext`, and neither does any schema create-concept writes.

   Optional: "says nothing about `graphContext`".

#### Harness friction

1. Nothing new. The gate's friction is round 1's.

### Verdict (round 3)

**PASS**

**What holds.**
- **Round 2's blocking finding is fixed.** The agreement sentence in the rule's definition, its firmware copy and `_schemas.js`'s header is now scoped to the elements create-element writes, and it names where else the two can split. Within that scope it holds, apart from the two narrow cases above. One of those is a known derive-step bug, already on the ledger.
- **Round 2's five non-blocking findings are each fixed.** SC9 now pins all four splits, and each of its assertions catches its own.
- **Across the three rounds:**
  - create-element does what ADR 0020 and Amendment 1 decided;
  - every criterion and refusal has a test;
  - the live check's record covers what the fake can't;
  - nothing signs;
  - and the 22 suites pass.

**Still to come:** the full gate in the pull request's CI. Once the change is on staging, the firmware reinstall that ledger row `2026-11-16-rule-seven-awaits-firmware-reinstall` asks for.

## On PASS (same commit)

- [x] Story `**Status:**` set to `Done` in place, in this review's commit.
- [x] Completion detection performed. The result is in the chat, not in this file.
