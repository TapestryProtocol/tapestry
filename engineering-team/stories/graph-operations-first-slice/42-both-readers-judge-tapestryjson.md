# Story 42: Both readers judge a node's tapestryJson — the rule `element-fits-schema` and the derive step give one verdict

**Status:** Approved
**Created:** 2026-11-17
**Type:** Feature
**Loom:** A10.20.b — https://loom.brainstorm.world/t/A10.20.b

## Background

ADR graph-operations-first-slice/0020a (merged in TapestryProtocol/tapestry#125, Loom A10.20.a) decided which document a concept's JSON Schema describes. It is a node's **tapestryJson**: the JSON the Tapestry LMDB (the tapestry-store, not strfry's LMDB) holds for the node under its tapestryKey. The rule: a node's fully realized tapestryJson validates against the JSON Schema of each concept it is an element of (BIBLE §10's rule 4; the owner's D9). The ADR says both readers judge that one document, through one check, and that firmware's `word` schema stays as it is. Exceptions to the rule, for performance, come later.

At this story's planning (2026-11-17), the owner split the ADR's build in two:
- **This story** makes the readers of a node as it stands judge its tapestryJson, and give one verdict. It also stops the writes reporting `word` as failing for what only the derive step builds.
- **Loom A10.20.c** makes the writes leave their node's tapestryJson up to date, built one concept at a time after they commit, starting with `graph create-element` and `graph update-node`.

What today's instance does, that this story changes:

- **Two readers, two documents.**
  - The rule `element-fits-schema` (rulebook §7) judges a node's `json` tag.
  - The derive step judges the tapestryJson it builds: its existing entry when that has a `word` block, else the `json` tag, else `{}`, with `word` defaults filled in and its own `graphContext` added.

  Their verdicts split, as the ledger row `2026-11-16-derive-step-and-rule-check-split` lists, and test SC9 pins four of the splits.
- **They judge different concepts.** The rule judges each concept whose class thread reaches the node. The derive step judges each concept header whose class thread reaches it within ten links, and each one the node's `z` tags name.
- **Every element of `word` reads as broken.** Firmware's `word` schema requires `graphContext`, which only the derive step builds.
  - Judged as `json` tags, all 83 of firmware's element files fail it, each only for `graphContext` (measured 2026-11-17).
  - Firmware puts seventeen concepts under `word`. On the local instance, `word` has 503 elements.
  - `graph create-set` reports on every create that the new set doesn't fit `word`. `rules check` (A10.31) would report every one of those 503.
- **Not every node has tapestryJson yet.** On the local instance, 80 of 485 list items, 9 of 53 supersets and 9 of 49 concept headers have none (2026-11-17). An element `graph create-element` makes has none until a derive pass runs.
- **No code acts on the derive step's verdicts.** They sit in each node's tapestryJson, as `graphContext.parentJsonSchemas`. A person or an agent sees them through `GET /api/tapestry-key/:key`.

## User-facing description

As the owner, or an agent of an admin working the graph, I want one answer to "does this node fit the schemas of the concepts it belongs to?", judged on the node's tapestryJson, whoever asks. Then `rules check`, the property operations' reports, a write's report and a node's cached verdicts never contradict each other, and the elements of `word` stop reading as broken.

## Acceptance criteria

- [ ] **AC1 — The rule judges a node's tapestryJson.** Take a node whose tapestryJson and `json` tag differ. When the rule checks it as it stands, it judges the tapestryJson. For example, a node whose tapestryJson has its `graphContext` fits firmware's `word` schema, whatever its `json` tag holds. A node whose tapestryJson lacks a field its concept requires doesn't fit, even when its `json` tag has the field.
- [ ] **AC2 — A node with no tapestryJson yet.** When the rule checks an element that has no tapestryJson, it gives one finding for the node, saying it has no tapestryJson yet. It gives no finding for each of its concepts' schemas, and it doesn't fall back to the `json` tag.
- [ ] **AC3 — One verdict, from both readers.** For a node the derive step has built, its cached verdicts and the rule's check of the same node agree on each concept:
  - on whether it fits, doesn't fit, or can't be checked;
  - on the problems, in the rule's words.

  They judge the same concepts: each whose class thread reaches the node. A concept only a `z` tag names is judged by neither. This holds under each of these:
  - firmware's `word` schema, which a node fits once its `graphContext` is built;
  - a schema that forbids extra top-level keys;
  - a `word` block missing a field the derive step fills in;
  - an entry built before the node's `json` tag last changed.
- [ ] **AC4 — A write doesn't fail a node for what the derive step builds.** When `graph create-element`, `graph create-set` or `graph update-node` judges JSON with no `graphContext`, it sets aside every problem that is only about `graphContext`.
  - A concept the JSON misses only for `graphContext` is reported as waiting for the derive step. The write neither reports it as not fitting nor refuses for it.
  - A concept the JSON misses for other things too is reported, or refused, for those things alone.
  - Every other verdict and refusal is as today.

  So a set made by `graph create-set` reports `word` as waiting, not failing.
- [ ] **AC5 — The rulebook says what the rule judges.** The rulebook's entry 7, and rule 7's element in the graph after a firmware reinstall, say that the rule judges a node's fully realized tapestryJson. They also say that a node with no tapestryJson is reported, and that exceptions will come. ADR 0020a reads as accepted.

## Concepts touched

`<TA>` is the instance's assistant (`GET /api/assistant/pubkey`).

- `39998:<TA>:word` — word (read: its schema governs every node's `word` and `graphContext`; it doesn't change).
- `39998:<TA>:graph-rule` — graph rule (rule 7's element, regenerated from the rulebook).
- Any concept, through its header, superset and JSON schema (read: its elements are judged).

## Out of scope

- **Loom A10.20.c:**
  - the writes leaving their node's tapestryJson up to date after they commit, one concept at a time;
  - the derive step rebuilding one section and keeping the others;
  - a `json` tag with no `word` block keeping its sections in tapestryJson;
  - a write's refusal judging the tapestryJson its node will have.
- **Building tapestryJson for nodes that have none.** A firmware reinstall's derive pass and `cache rebuild` (A10.36) do that.
- **`rules check` (A10.31) and the property operations' reports (A10.18) themselves,** and what `rules check` does with a node that has no tapestryJson.
- **The exceptions to the rule,** and where they live.
- **Moving the Health Audit and the concept pages onto tapestryJson.**
- **Changing firmware's `word` schema** (ADR 0020a, Decision 6).
- **Moving the schemas' dialect to draft 2020-12.**

## Open questions

- None that block planning.
- The full test gate writes to the stack it finds, and on the Mac Studio that is the agent-memory instance. So the Tester and Implementer run only the suites they touch there, and the pull request's CI runs the full gate. AC1 to AC4's live checks run on a scratch stack (`scripts/scratch-stack.sh`).

## Deviations

- **`schemaOf` returns `name` and `nodes` with every problem,** not only with "more than one" (ADR 0042, Decision 5). So a concept whose one schema node can't be read still gets a cache entry, with `valid: null`, naming that node. That is the same entry the rule's `no-schema` stands beside.
- **`tapestryJsonOf` is synchronous,** since the store's `get` is. It answers "no node was named" for an empty key.
- **A cache entry leaves out `uuid` when the schema node has none.** Firmware `word`'s schema types it as a string, so a null would break the node's own fit. `schemaVerdicts` also takes an optional `read`.
- **`deriveAll` builds its pass's judge from `runCypher` inline,** with the same read `schema-verdicts.js` makes.
- **GB3's fixture** (`test/graph-rules-builder.test.js`) restated rule 7's old first Says sentence and Source. It was amended in the Tester's lane, in a commit of its own, before the implementation commit; the test plan records it.
- **Firmware:** rule 7's element file was regenerated. Its reinstall on staging and production after merge is ledger row `2026-11-17-rule-seven-rewrite-awaits-firmware-reinstall`.

## Linked artifacts

- Decision: ADR graph-operations-first-slice/0020a (`engineering-team/decisions/graph-operations-first-slice/0020a-the-document-a-schema-describes.md`)
- ADR: `engineering-team/decisions/graph-operations-first-slice/0042-both-readers-judge-tapestryjson.md`
- Test plan: `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.test-plan.md`
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
