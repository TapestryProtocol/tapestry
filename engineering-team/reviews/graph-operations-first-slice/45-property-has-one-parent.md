# Review: Story 45 — a property hangs under one parent: `rules check`, `rules repair`, and the old routes

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-20
**Diff:** `git diff 1abd2889..81bdd746`: 25 files, +2720 −59. `1abd2889` is `origin/staging` when the branch was cut. The range holds five commits:
- `5ce992cf`: the story and the epic's entry;
- `c586fc2f`: ADR 0045 (Option A, accepted);
- `44bfead7`: the test plan, the five new suites under `test/operations/rules/`, the seed `test/helpers/propertyParentsGraph.js`, the `route` kind in `test/helpers/saveSchemaChild.js`, and ADR 0045 Amendment 1;
- `488a4811`: rule 11 added to the rulebook suites' pinned lists (`graph-rules-builder`, `graph-rule-firmware`), and the test plan's Test Design amendment;
- `81bdd746`: the implementation, rulebook entry 11 and its firmware element, entry 10's one sentence, the catalog's two rows, the ledger row, and the story's Deviations.

**Against:**
- the story, [45-property-has-one-parent.md](../../stories/graph-operations-first-slice/45-property-has-one-parent.md), with its Deviations;
- [ADR 0045](../../decisions/graph-operations-first-slice/0045-property-has-one-parent.md), Decisions 1–13 and Amendment 1;
- the [test plan](../../stories/graph-operations-first-slice/45-property-has-one-parent.test-plan.md), with its Test Design amendment, and the live-check record in the ignored `tmp/live-check-45/`.

**How it was made.** A Reviewer agent with no Edit access wrote this review at the session's request.
- It ran the gate itself, stack-free: stub `curl` and `docker` first on `PATH`, every endpoint on a dead port, `TAPESTRY_CONTAINER=no-such-container`. It never ran `npm test`, never touched the `tapestry` container, and made no call to localhost:7778.
- It probed the scratch stack (`tapestry-scratch`, assistant `ec016978…`) with one read: `tapestry rules check --scope graph` judged 51 properties and found 0.
- Its one probe, `tmp/review-45/slug-collision.js` (ignored), runs the real normalize handlers in the old-routes suite's child harness (`test/helpers/saveSchemaChild.js`, kind `route`). That harness records every write and applies none, and nothing leaves the process. Run it with the gate's environment: `node tmp/review-45/slug-collision.js`.
- The session's brief limits it to this file and its probe. So it doesn't commit, and it leaves the story's status alone.
- The independent check before the commit (workflow 5, P13) wasn't applied.

**Verdict:** CHANGES_REQUESTED, with two blocking findings and six non-blocking ones.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`) was not run. On this Mac the local stack is the owner's live agent-memory instance, and the full suite writes to it. CI's stack-free job runs it on the pull request.
- [x] **The scoped gate** at `81bdd746`, through the gate engine, with an explicit list: `operations.test.js` (every suite under `test/operations/`, so the five new ones too), `external-cli`, `openapi-coverage`, `admin-action-sweep`, `schema-save-finds-the-right-header`, `graph-rules-builder` and `graph-rule-firmware`. Its `npm run gate:status -- --label a10-31-a-review-1` line:

  ```
  20261120T061012Z-14275-efc4 [a10-31-a-review-1] started 2026-11-20T06:10:12.454Z on 81bdd746 — PASS, exit 0, 1352 passed, 0 failed, 10 skipped, 7/7 suites · /Users/wds4/repos/TapestryProtocol/tapestry/tmp/gate-runs/20261120T061012Z-14275-efc4.json
  ```

  - **By suite:** operations 1212 passed, 4 skipped; external-cli 53; openapi-coverage 13; admin-action-sweep 9; schema-save-finds-the-right-header 26, 2 skipped; graph-rules-builder 26; graph-rule-firmware 13, 4 skipped (live).
  - **The new suites, inside operations:** rule property-has-one-parent 11 passed (PH1–PH11); rules check 11 (CK1–CK11); rules repair 16 (RP1–RP16); the old routes 7 (OR1–OR7); the agent through the external CLI 1 (XR1).
  - It matches the Implementer's run (`20261120T060326Z-1459-27d8`: PASS, 1352 passed, 0 failed, 10 skipped). The log is in `tmp/review-45/gate-review-1.log`.
- [ ] `npm run test:playwright`: not applicable (no UI change).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

**Live checks.** These were read from the record, not re-run. `tmp/live-check-45/out/` holds every step's answer:
- L1: a check of the fresh install's graph (judged 40, found 0); the tangle made by one `MERGE`; update-property refused `tangled-tree`; check names `venture` with a fix; the repair, recorded as `{ role: local }`; check again finds nothing; update-property goes through; the repeat answers `nothing-to-repair`.
- L2: backup, re-tangle, restore, check finds nothing.
- L3: install, check finds nothing, and the graph rule item is there.
- L4: the old routes' properties, none found.

The tangle had no relationship element, so `letters` was `[]` live; the letters lookup ran on real Neo4j and matched none. For what the record doesn't say, see non-blocking 5.

## Spec adherence

- [x] **AC1** — entry 11 is in the rulebook's format (PH9). It only reports (PH1). Its code is one definition, used by `scan` and `violations`, and by check and repair. The firmware item is generated (PH10; GB2–GB6, GF9 with the list amendment). The property writes are unchanged (`_properties.js` isn't in the diff).
- [x] **AC2** — CK1–CK11 and PH2–PH8. A finding gives the node, its concepts, each parent's `kind`, `concept` and `ofItsConcept`, and either `fix` or `choice`. Every author's nodes are judged, and nothing changes (CK8). The live case's shape is the seed's `grokProject`.
- [x] **AC3** — RP1 compares the whole graph and finds the graph before less one relationship, plus one entry. RP2–RP6 cover the answer, history by property, schema and concept, `tangled-tree` before and update-property after, the repeat, and lock-then-delete-then-entry.
- [x] **AC4** — PH6, RP9 and RP10. But the other-author case comes from the rule, not the repair: blocking 2.
- [x] **AC5** — CK5, CK6, RP7, RP8 and RP13. `firmware-concept` names `firmwareOverride` and the concept. A scope repair lists firmware's findings in `left` with that way on (RP10).
- [~] **AC6 / AC7** — OR1–OR7 and L4 show what the criteria ask: no schema link, the parent's address, the refusals that name `POST /api/normalize/skeleton`, and one name on two concepts as two nodes. But the parent-derived address brings a new way to overwrite an existing node: blocking 1.
- [~] **AC8** — 401, 403 and 415, the listing, /docs, the internal command as who made it, XR1 and L1–L3. The literal "through the external CLI on a scratch stack" and "restored on a fresh instance" are met only in split: non-blocking 5. Zeus on david.tapestry.ninja comes after the merge, on the owner's yes, and isn't part of this gate.
- [x] **No behavior beyond the story**, apart from blocking 1's side effect.

## ADR adherence

- [x] **Decision 1:** the codes, their order and the fix condition, with Amendment 1's own-concept condition, are at `property-has-one-parent.js:131-190`. Two caveats: the reads are seven statements, not two, and V2 runs for every judged item, not only findings (non-blocking 1).
- [x] **Decision 2:** `scan` is optional, and the loader checks that it is a function (`rules/index.js:50`). The three scopes are as written.
- [x] **Decision 3:** the finding's shape matches. The id is a SHA-256 over `{ code, node, sorted parent keys }`, 12 hex, in `_rules.js:97-102`.
- [x] **Decision 4:** `scope` is `graph` or a key. A header is a concept. A missing node, a change entry or a tag is refused `unknown-node` (404), with `input: 'scope'`.
- [x] **Decision 5:** check matches: the inputs, the paging by `[node, rule]`, the fingerprint over the scope and sorted rules, the answer's shape, and the refusals.
- [~] **Decision 6:** the steps are in order:
  - bad-target, then parse, then rule, then scope;
  - scan and judge;
  - lock each `fix.concept` in tapestryKey order (at most 100);
  - judge again;
  - nothing-to-repair, `changed-since-check`, `firmware-concept`, or left;
  - delete;
  - judge the fixed nodes again and throw on a miss;
  - letters.

  Violation mode doesn't confirm that the fix's concept is locked (non-blocking 2).
- [ ] **Decision 7:** the firmware override is in the repair. The other-author guard is not, though Amendment 1 says it stays there: blocking 2.
- [x] **Decision 8:** the cap of 100, and `remaining = fixable − done` (RP12 for one concept). I traced the many-concepts case by hand: the headers come from the first 100 allowed findings, and the work is the first 100 of those whose concept is locked. It's right.
- [x] **Decision 9:** `relationship-removed { type, from, to, node, concept, rule, count, firmwareOverride? }`. `CHANGE` gains `rule` and `firmwareOverride` (`changes.js:65-66`). The entry's keys come from node, from, to and concept (RP3).
- [x] **Decision 10:** RP1 shows the node, its tags, JSON, `ENUMERATES`, `HAS_ELEMENT`, the schema node, the tree graph and the letter all stay.
- [~] **Decisions 11 and 12:** as written. But "the same address `graph add-property` … give[s] the same property" collides with the routes' name-based duplicate check: blocking 1.
- [x] **Decision 13:** entry 11, the firmware element, the catalog rows (§4), the ledger row (stays OPEN), and entry 10's one sentence ("left one before story … #45").
- [x] **No new dependencies**, and no lint, typecheck or build tooling.

## Concept-graph integrity
- [x] **Handles** stay in `kind:pubkey:slug` form. Relationship types come from `K.rel()` aliases in the rule. The routes keep the `REL.*` aliases.
- [x] **Firmware reinstall:** no concept definition changes. The new graph-rule element reaches an instance at its next install, which waits for the owner (story, Out of scope; ADR Consequences). L3 shows the reinstall doesn't bring back the removed link.
- [x] **Orientation:** not applicable to runtime code. The handles are named in the story and ADR by `<TA>`.

## Things tests can't catch
- [x] **No secrets.** The old-routes suite's `'22'.repeat(32)` is a test key, used in a child process only.
- [x] **No debug logging and no commented-out code** in the diff's `src/`.
- [x] **No hardcoded TA pubkey.** No 64-hex literal is added under `src/` or `firmware/`. The TA comes from `K.assistant()` and `getOwnerAssistantPubkey()`, and the firmware check from `firmware.conceptUuid`.
- [ ] **Error paths and edge cases:** blocking 1, and non-blocking 3 and 4.
- [x] **Concurrency.** The lock is `S.lockNode`, the same as the property writes'. Headers are locked in key order. The re-judge comes after the lock, and Neo4j's read-committed reads see the other transaction's commit. Two repairs of one violation give one repair and one `nothing-to-repair`. I found no deadlock cycle with the property writes, which lock one header each.
- [x] **Security:** both routes are `owner-and-admins`. The `DELETE` statement's type comes from the rule's own constant, never from input, and the keys are parameters.
- [x] **Invariant 1, POV-first:** the rule is structural, with no trust input. Check judges every author's nodes.
- [~] **Invariant 2, decentralized-first:** nothing is gated at write time. Another author's tree is left as their claim, but only because the rule says so (blocking 2).
- [x] **Invariant 3, filter at view time:** check computes on each call and stores nothing.
- [ ] **Invariant 4, local-first (BIBLE §30):** the repair removes one edge, records it whole in the change entry, and leaves the letters. The old routes can now overwrite an event-less node's tags: blocking 1.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling without an ADR.

## Findings

### Blocking

1. **`src/api/normalize/index.js:3508-3548` (create-property) and `:4153-4196` (enumerate with `createProperty`): the parent-derived address lands on an existing property whose name slugs alike, and the route overwrites it.**

   **Why the address collides.** `dtag.childDTag` slugs the name (`src/lib/dtag.js:22-28`, `:51-54`), so "First Name", "first_name" and "first-name" under one parent share one address. Neither route sees the existing node:
   - create-property's duplicate check compares the exact name (`p.name = $name`, `:3509-3515`);
   - enumerate's lookup compares lowercased name tags (`:4153-4158`), so "first-name" doesn't find "first_name".

   **What happens.** Each route signs at the shared address, and `importEventDirect` (`:139-172`) puts the new event on whatever node holds it. An event-less node made by `graph add-property` takes `NostrEvent` and loses every tag, its `json` tag (its JSON Schema piece) among them. It gets the new event's tags instead: create-property's minimal `json`, and none at all from enumerate. Either way the node is renamed, and the route answers "created".

   **The probe.** `tmp/review-45/slug-collision.js` sets up an event-less `first_name` under grok bot's primary property, with an `enum` in its `json` tag. Two calls each wrote 11–12 statements naming that node's address, among them `MATCH (e {uuid: $uuid})-[r:HAS_TAG]->(t:NostrEventTag) DELETE r, t`, and each published an event there:
   - create-property `{ name: 'First Name', concept: 'grok bot' }`;
   - enumerate `{ property: 'first-name', targetConcept: 'grok bot', createProperty: true }`.

   **Why it is new.** Before this diff both routes hashed the `property` concept's address, which no `graph add-property` or `generate-property-tree` node uses. So the diff opens a new way for a normalization route to destroy locally authored, event-less state (CLAUDE.md invariant 4; BIBLE §30). It also lets the routes replace a `generate-property-tree` node's signed letter. A case-only difference ("Price" beside "price") is enough for create-property, and the New Property form takes free text. ADR 0045 Decision 12 means the shared address to name "the same property". But the routes decide "same" by name, not by address, and `graph add-property` already handles slug-alike keys with nonces (`src/operations/catalog/graph/_properties.js:775-806`).

   **Asked change:**
   - before anything is signed, each route checks whether a node already holds the address it computed. Either it refuses, in its own `{ success: false, error }` style, naming that node and the way on (D15's cheap fix), or it takes the first free nonce, as `graph add-property` does;
   - an ADR 0045 amendment to Decisions 11 and 12 says which;
   - one test per route goes in the old-routes suite: a slug-alike name beside an event-less node under the same parent, asserting that no write names that node's address and, on a refusal, that nothing is signed.

2. **`src/operations/catalog/rules/repair.js:110` and `:149-152`, with the claims at `:10-11` and `:60`: the repair has no other-author guard.**

   **What the ADR says.** ADR 0045 Amendment 1: "Decision 7's other-author case stays in the repair as a guard, and is never reached through check's findings". Option A's pros: "the firmware override and the other-author choice are written once, in the repair, for every rule".

   **What the code does.** The repair's whole policy is `allowed = (f) => !!f.fix && (!f.fix.firmware || override)`. It fixes any finding whose rule planned a fix, and reads neither the header's author nor `concepts[].own`. Another author's concept is left today only because the rule withholds its fix (`src/operations/rules/property-has-one-parent.js:182-189`). RP9 passes for that reason too, not because the repair refuses.

   **Why it matters.** The file's header comment and its `/docs` description ("and never another author's", `:60`) promise a guard that agents read and the code doesn't have. The next rule A10.31 adds will join this repair by putting a `fix` in its findings, and it would get no guard. The story's Deviations don't record the change.

   **Asked change.** In `apply`, after the locks and the re-judge, put in `left` every fix whose concept header isn't the instance's own: its author isn't `K.assistant()`, read in the transaction. Use the author's-claim why (D4). Either drive this in a test, with a stub rule in a child process say, or record in the test plan that the Reviewer reads it, as step 9 is. Or, if the policy is meant to live in each rule's fix, amend the ADR and make the comment and the `/docs` text say so. That choice is the Architect's, with the owner.

### Non-blocking

1. **`docs/GRAPH_RULES.md:174`, and the generated `firmware/versions/v1.0.0/concepts/graph-rule/elements/property-has-one-parent.json` `check`.**
   - **The read count.** The entry says "in two reads over all of them at once", but `violations` runs up to seven statements (`property-has-one-parent.js:98-143`): NODES, PRIMARY_OF and PARENTS, then PRIMARY_OF, SCHEMA_OF, TREES_OF and HEADERS over the parents. That is a fixed number whatever the count of nodes. The firmware item will carry the sentence to every instance. Suggest "in a fixed number of reads over all of them at once".
   - **TREES_OF's reach.** ADR Decision 1's V2 reads "only for items with a finding", but TREES_OF (`:125`) runs over every judged item and its property parents before any code is known, and the codes don't use it. On a large graph that's an upward walk per property. Narrowing it to `findings0` would match the ADR.
2. **`src/operations/catalog/rules/repair.js:144-146`.** In violation mode, `todo = [f]` doesn't check that `f.fix.concept` is one of the headers locked after the first judgment, as scope mode does (`:150`). Two ids match only when the node's code and parents do, and a tangled concept's property writes are refused, so I found no way to reach the gap. A `locked.includes(f.fix.concept)` check would make the two modes agree.
3. **`src/operations/catalog/rules/repair.js:135`.** A well-formed violation whose node doesn't exist answers `nothing-to-repair`, as Decision 6 step 6 says. That includes a random key, or a key in uppercase hex, which `KEY_BODY` accepts but `scan`'s exact match never finds. Such an answer can't be told from a real repeat. Consider `unknown-node` when no node holds the key, or lowercasing the key when parsing.
4. **`src/operations/catalog/rules/repair.js:152`.** A scope repair's `left` is neither capped nor paged. A graph-wide repair on an instance with many choices answers every one in one body. Decision 8 caps only the fixes.
5. **The story's Deviations against `tmp/live-check-45/`.**
   - **The stop and resume.** The first run's L3 item step found no row and stopped (`live.log:265-284`). A run resumed from that step found the item (`live-resume.log`; `out/L3-3-graph-rule-item.txt`). The Deviations say "all passed" and name two differences, but not this stop and resume, nor what changed between the runs.
   - **AC8's split.** The literal "an admin agent … through the external CLI" on a scratch stack, and "restored on a fresh instance", are met only in split: XR1 is stack-free with the real sign-in and catalog; L1 used the internal command on real Neo4j; L2 restored on the same instance after re-tangling. I take the split as evidence. The owner should ratify it, since the criterion's words differ.
6. **The test plan's "How to run" gate list** names five entries. Its own Test Design amendment adds `graph-rules-builder` and `graph-rule-firmware` as pinning the rule list, and this review's gate ran them. Suggest adding them to the list.

### Harness friction
1. None beyond non-blocking 6.

## Verdict
**CHANGES_REQUESTED**

The rule, `rules check` and `rules repair` are well built and well tested. The finding ids, the lock order, the re-judge, the cap and `remaining`, the firmware override, the change entry's keys and what a repair leaves all match ADR 0045, and the scoped gate passes (`20261120T061012Z-14275-efc4`, PASS, 1352 passed, 0 failed). Two things block the merge:
- **Blocking 1.** The old routes' new parent-derived address lets a slug-alike name overwrite an existing property node, event-less ones included, through a normalization route. That breaks invariant 4 (BIBLE §30), and it is new in this diff.
- **Blocking 2.** The repair lacks the other-author guard that ADR 0045 Amendment 1 puts there, while its comment and `/docs` text say it has one.

Both fixes are small. Blocking 1 needs an ADR amendment to Decisions 11 and 12 and a test per route. Blocking 2 needs either the guard or an ADR amendment.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place: not applicable (CHANGES_REQUESTED). The brief also left the status alone.
- [ ] Completion detection: not applicable until a PASS.
