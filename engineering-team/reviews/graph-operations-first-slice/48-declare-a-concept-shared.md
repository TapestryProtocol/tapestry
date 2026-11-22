# Review: Story 48 — Declare one of the instance's own concepts a shared concept, wire it, or mark it deliberately unaffiliated, through the graph operations

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-21
**Diff:** `git diff origin/staging...HEAD`, that is `cc3715f0..a8432b7c`: 20 files, +2329 −12. The merge base is the ADR's commit, which reached staging through PR #192; staging has since moved to `ff8ec4cc`. The four commits:
- `1d703832`: ADR 0048 Amendment 1 (1 file);
- `092511d9`: the test plan, the failing tests and `test/helpers/sharingGraph.js` (10 files);
- `8a55445c`: one entry in `test/operations/lifecycle/nostr-event-lookups-kept.json`, made in the Tester's lane at Implementation, with the test plan's "Added at Implementation" (2 files);
- `a8432b7c`: the implementation, the docs and the story's Deviations and Evidence (9 files, none under `test/`).

**Against:**
- the story, [48-declare-a-concept-shared.md](../../stories/graph-operations-first-slice/48-declare-a-concept-shared.md), with its two amendments at Architecture, its Deviations and its Evidence;
- [ADR 0048](../../decisions/graph-operations-first-slice/0048-declare-shared-wire-to-shared-defer-sharing.md): Decisions 1–10 and Amendment 1, items 1–7;
- the [test plan](../../stories/graph-operations-first-slice/48-declare-a-concept-shared.test-plan.md), with its "Added at Implementation";
- the live check's records in the worktree's ignored `tmp/live-check-48/`, read only (`keys.json` wasn't opened).

**How it was made.** A reviewer agent with no Edit access wrote this review at the session's request.
- It never ran `npm test`, booted no stack, and made no call to any container, GitHub or Loom.
- Every suite ran through the session's wrapper, `safe-run.sh`: stub `curl` (exit 7) and `docker` (exit 1) first on `PATH`, `BRAINSTORM_CONF_PATH` on a conf whose Neo4j is a closed port, `BRAINSTORM_BASE_URL` and `TAPESTRY_PORT` on dead ports, and `TAPESTRY_CONTAINER` and `TAPESTRY_CONTAINER_PORT` unset. Every base-URL default in the suites run goes through `BRAINSTORM_BASE_URL`, and `event-less-create-set`'s container base goes through `docker exec`, which is stubbed.
- The gate runs used Node v24.18.0. The env check below used v22.23.1, CI's and the image's major version.
- Its derivation scripts, the env check and the runs' output are in the ignored `tmp/review-48/`. The run records are in `tmp/gate-runs/`.
- `git status` was clean after every run.
- The independent check before the commit (workflow 5, P13) wasn't applied.

**Verdict:** PASS. No blocking findings; five non-blocking, and one harness sighting.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`) was not run. On this Mac the container named `tapestry` is the owner's live agent-memory instance. CI's stack-free job runs the full gate on the pull request.
- [x] **`test/operations.test.js` alone**, through `test/helpers/gateRunner.js`, on a clean tree at `a8432b7c`. Its `npm run gate:status -- --label review-48-operations` line, with the path shortened:

  ```
  20261121T234445Z-74369-aeee [review-48-operations] started 2026-11-21T23:44:45.286Z on a8432b7c — PASS, exit 0, 1554 passed, 0 failed, 20 skipped, 1/1 suites · …/tmp/gate-runs/20261121T234445Z-74369-aeee.json
  ```

  Inside it, the 50 new tests pass: declare-shared 14, wire-to-shared 18, defer-sharing 11, the export cases 6 and the agent suite 1. So do MF15, EN29, and `tapestry-key-paths`' G11 and G18 (20 of 20). This reproduces the story's Evidence exactly.
- [x] **The rest of the scoped gate,** derived from the final diff (below), 53 suites in one `runGate`. Its `npm run gate:status -- --label review-48-scoped` line:

  ```
  20261121T235116Z-83866-338d [review-48-scoped] started 2026-11-21T23:51:16.488Z on a8432b7c — FAIL, exit 1, 1655 passed, 10 failed, 87 skipped, 53/53 suites; failed: safe-to-merge-check, router-stream-limit-on-connect · …/tmp/gate-runs/20261121T235116Z-83866-338d.json
  ```

  The record names the ten failures, and they are exactly this Mac's known ones:
  - `safe-to-merge-check` B1, B2, B3, B5, B6, B8 and B9 time out behind the stub `curl`;
  - `router-stream-limit-on-connect` P1–P3 fail on BSD `sed`.

  Neither failure comes from this diff. P1–P3 test the strfry router's `sed` patch, and the B tests wait on the stub `curl`. Of the files this diff changed, only `BIBLE.md` is read by either suite: `router-stream-limit-on-connect` B1 checks §14's wording, and passes. `safe-to-merge-check` reads the `.claude/skills/cycle-*` skill files, not the changed one. The other 51 suites pass. The Implementer's 48 gave 1,582 passed, 10 failed and 82 skipped. The five this review added give 73 passed and 5 skipped, so the totals agree.
- [x] **Two more scans of all of `src/`**, found after that run began, in a third `runGate` (`--label review-48-extra`):

  ```
  20261121T235651Z-28864-4ff4 [review-48-extra] started 2026-11-21T23:56:51.169Z on a8432b7c — PASS, exit 0, 30 passed, 0 failed, 1 skipped, 2/2 suites · …/tmp/gate-runs/20261121T235651Z-28864-4ff4.json
  ```
- [x] **The merge with staging.** Since the merge base, staging has gained the engine that fails a suite whose load or run leaves `process.env` changed (test-suite-hermeticity #4, ADR test-suite-hermeticity/0002). `operations.test.js` runs its sub-suites in the gate's own process, so each new sub-suite has to leave `process.env` as it found it.
  - `tmp/review-48/env-check.js` loads and runs the five new suites in one process and compares `process.env` after each load and each run.
  - On Node v22.23.1, none changed a key (`env-check-node22.txt`), and all 50 tests passed.
  - Staging's changes and this branch share no file.
- [ ] _Playwright: not applicable, since no UI changed._
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

**How the scoped list was derived** (`tmp/review-48/derive.js`, `derive2.js`). It holds:
- CI's five entries for an operations change: external-cli, openapi-coverage, admin-action-sweep, schema-save-finds-the-right-header and gate-result-record;
- every registered suite whose source names a file or module this diff changed or calls: `BIBLE.md`, the catalog, `inherit-from.md`, `SKILL.md`, `nostr-event-lookups-kept.json`, the four new source files and `bValueForms.js`;
- every registered suite that scans all of `src/`, which the new files have now joined.

`operations.test.js` ran alone, and `event-tagging-firmware-seed`, which reads a live URL, was left out. The Implementer's 48 (`tmp/a10-44-impl/suites.txt`) are all on the list. The final diff brings in seven more (harness sighting 1).

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

| Criterion | Code | Tests (all passing) |
|---|---|---|
| **AC1, declare.** One self-pointing pointer `b`; a marker goes; other tags and JSON kept; one entry naming who made the call; nothing signed; `letterOutOfDate`; a repeat answers `already-declared` | `declare-shared.js:54-67`; `_dispositions.js:73-90, 127-151, 177-186` | DS1–DS7, DS11 |
| **AC2, wire.** `["b", <target>, "pointer"]` once, beside any `b`; an address or an naddr of kind 39998; a repeat answers `already-wired`; an unheld target is reported and written | `wire-to-shared.js:58-78`; `_dispositions.js:96-123, 163-173` | WS1–WS9, WS17 |
| **AC2, defer.** The marker once, on a header with no real `b`; a repeat answers `already-deferred` | `defer-sharing.js:54-69` | DF1–DF3, DF5, DF6 |
| **AC3, refusals,** each with a test, each changing nothing | `_dispositions.js:73-90, 105-107`; `wire-to-shared.js:66-68`; `defer-sharing.js:62-64` | Callers: DS10, WS13, DF8 (401, 403; 415 in DS10). Header: DS8, WS12, DF7 (not a header, another author's, at the owner's key, firmware). `not-installed`: DS9, WS12, DF7. `bad-target`: WS10, WS18. `self-target`: WS11, WS18. `affiliated`: DF4. The order: WS18, DS8, DF7 |
| **AC4, export.** Each `b` as held, the self-pointing one included; a dry run's `new` and `changed`; `z` stamps up to five; the marker travels | Export unchanged: nothing under `src/operations/catalog/export/` is in the diff (Decision 9) | EB1–EB6 |
| **AC5, declared once,** with its route, internal command and `/docs` entry made from the declaration | the three declarations | DS13, WS16, DF11; DS10, WS13 and DF8 for the command |
| **AC5, the catalog and docs** | `docs/GRAPH_OPERATIONS_CATALOG.md:41-49, 86-88, 247-248`; `BIBLE.md:1854`; `protocols/drafts/inherit-from.md:4`; `clients/cli/skill/SKILL.md:9` | DS14, MF15, EN29 |
| **AC5, an agent** through the external CLI declares a concept shared and exports it; the letter read back carries the self-pointing `b` | — | XS1, stack-free. The live check on a scratch stack: LH1, 25 of 25 (`tmp/live-check-48/by-hand.log`). It ran the committed files: the digests of the four new files in the container match HEAD's |

The docs were checked against the code line by line:
- §2's three rows, with their inputs, answers, repeats and refusals;
- "At a glance": 6 + 9 + 8 + 4 + 2 = 29 graph writes, and 10 + 29 + 6 + 3 + 4 + 4 + 3 + 6 = 65 operations;
- §9's two rows;
- BIBLE §25's bullet, which sits inside §25 (`BIBLE.md:1846-1857`);
- the skill's sentence.

They hold, apart from non-blocking 2 and 3.

## ADR adherence

- [x] Files changed match the ADR's implementation notes: the helper module and three declarations in `src/operations/catalog/graph/`, and the four docs. Nothing changed in export, import, the routes, `routeAccess` or firmware.
- [x] Layering and module boundaries are respected. `bValueForms.js` stays the one owner of the value forms: `SENTINEL`, `classifyBValue` and `dispositionOf` are required, never copied.
- [x] No new dependency. `nostr-tools` was already one, and `package.json` is untouched.

Decision by decision:
1. **Three writes in the `graph` group.** `kind: 'write'` and `access: 'owner-and-admins'` (DS13, WS16, DF11). Today's three routes and set-b-tag are untouched.
2. **Inputs.** `concept` is `N.keyInput`. `target` takes an address or an naddr of kind 39998 only, and no event id (WS10). *Deviation, recorded in the story:* the target is trimmed before its form is checked, as `b-append` trims it (`src/api/concept/bDisposition.js:158`).
3. **Which headers.** The refusals come in order: unknown-concept, then not-own-concept, then firmware-concept (`_dispositions.js:73-90`). The words say whose header it is, using `reads.js`' `ownKeys()`, which reads only public keys.
4. **Locks.** `K.lock`, then `S.lockNode`, before any read (DS12, WS15, DF10). In wire-to-shared they come after the form check, as Amendment 1 item 4 orders.
5. **What each writes.** Each new tag goes in through `E.tagRows(h.uuid, [tag], tags.length)` and `E.addTags`, and each marker comes out by tapestryKey with `DETACH DELETE`, as update-concept does. A repeat counts a `b` of any type: cat's untyped `b`, mouse's inherit one.
6. **The relationship.** `MERGE (a)-[r:REFERENCES {source: 'b-tag'}]->(b)` keeps its source in the pattern (WS8: firmware's stub isn't matched). The placeholder is import nostr's kind, made only when no node of any label is at the address (WS2, WS3), and a declaration draws a self-loop. *Deviation, recorded in the story:* when more than one node sits at an address, the relationship runs to one of them: the held one, else the lowest tapestryKey. Seed-firmware and `buildImportCypher` draw to each. Only a `NostrEvent`'s uuid is unique (`nostrEvent_uuid`; a `TapestryNode`'s is only indexed), so the rules alone don't rule such a pair out. But each writer this review read looks for a node of any label before it makes one at an address: create-concept's `freeD`, import nostr, `buildImportCypher` and seed-firmware. And Decision 6 says "the node".
7. **Answers.** The answer holds the outcome, `concept`, `disposition` with its `bValues`, `letterOutOfDate` and `target`. The refusals are declared, a repeat's `change` is null, and the `repeatKey`s are as decided. *Deviation, recorded in the story:* `disposition` is worked out from the values read after the locks rather than read again. In one locked transaction that gives the same answer.
8. **Change entries.** `tag-added`, `tag-removed` and `relationship-added`, in the existing shapes with no new field. `relationship-added` comes only from the statement's `relationshipsCreated` (DS7, WS8). `keysOf` takes `to` (`src/operations/changes.js`), so graph history finds a placeholder (WS2).
9. **Export doesn't change.** It doesn't; EB1–EB6 pin AC4.
10. **Docs.** All four were changed as decided.

**Amendment 1:**
1. `held` means a node at the address that has a `created_at` (`_dispositions.js:113-123`; WS3, with both kinds of placeholder).
2. `bValues` is distinct and sorted with JavaScript's default sort (`:179`).
3. A repeat's `target` is read from the graph, with `node` null when no node is there (WS4, WS5, WS17).
4. The order of the checks holds (WS18 counts nine bad-target transactions that ran no statement).
5. `target`'s schema is `{ type: 'string', maxLength: 2048 }` with no pattern (`wire-to-shared.js:38`).
6. The refusals say "another author", "owner", "graph declare-shared" and "concept-header".
7. MF15 and EN29 move to 65.

**The helper's names** differ from the Implementation notes, as the story records:
- `headerOf` also answers `tags` and `values`;
- `addB` and `dropMarkers` take the header's answer rather than `h`;
- `nodeAt`, `link` and `answerOf` are added.

Nothing goes outside ADR 0048 or its Amendment 1.

**The `test/` change after the Gate-3 commit is legitimate.** The ADR template's rule puts test-file changes in Phase 3, the Tester's lane, never in implementation. This is not the test-deliverable carve-out case, so the standing rule applies, and the change keeps it:
- `a8432b7c`, the implementation, touches no file under `test/`.
- The one later `test/` change, `8a55445c`, is a commit of its own in the Tester's lane, recorded in the test plan's "Added at Implementation".
- It changes no assertion. G11 and G18 read the kept-lines registry, and the entry names one line exactly, ``const PLACEHOLDER = `CREATE (p:NostrEvent {uuid: $uuid})``, at `_dispositions.js:154`.
- Its reason matches the code. The `CREATE` runs only when `nodeAt`'s lookup by `NostrEvent|TapestryNode`, in the same transaction, found no node there (`_dispositions.js:164-170`).
- It mirrors import nostr's entry for the identical placeholder, and story 32's review accepted four such entries, made in that story's implementation commit. This one is stricter: it is kept apart from the implementation.

## Concept-graph integrity

- [x] **Handles are in `kind:pubkey:slug` form.** Each `b` value is a header's address. The self-pointing one is built from the header's uuid, and every pubkey is read at runtime.
- [x] **No firmware reinstall is needed.** No concept definition or graph rule changed (ADR Consequences).
- [x] **Orientation.** Not applicable to server code. The ADR oriented on public summaries, since the local instance is off-limits.

**The architecture invariants:**
- **POV-first.** A `b` is the instance's own claim. Nothing computes or stores a global "shared" truth, and whether a target is itself declared shared is left to each point of view (ADR Out of scope).
- **Decentralized-first.** Any author's concept may be a target, held or not. The refusals limit only the instance's own writes: its own headers, and the form of the address it writes.
- **Filter at view time.** Nothing per-POV is stored. `disposition` is derived in the call from the `b` values.
- **Local-first, BIBLE §30.** The `b` and its relationship are written with no letter behind them. The only graph state the diff removes is the deferral marker, which the spec says a real `b` replaces. Firmware concepts are refused because a reinstall would drop the `b` (intake entry 2026-11-21). The remaining hazard is today's routes re-signing an older letter over a graph-made `b`, which is ledger row `ledger/2026-11-20-todays-importers-keep-their-faults.md` and out of the story's scope.
- **No hardcoded TA pubkey.** `K.assistant()` and `ownKeys()` read it at runtime. No added line holds a 64-hex literal or the local TA's prefix.

## Things tests can't catch

- [x] **No secrets in committed files.** Test keys are generated at runtime.
- [x] **No leftover debug logging,** `console.log` or `debugger` in the new source.
- [x] **No commented-out code.**
- [x] **Error paths are handled.**
  - A node or marker with no tapestryKey fails the call (500), naming `lifecycle migrate`.
  - The relationship statement throws when an end has vanished, so a `b` is never left without its relationship. The whole transaction rolls back.
- [x] **Concurrency.** Every concept write serializes on C1, and the header lock follows. Neo4j locks a new relationship's two ends, `executeWrite` retries a deadlock, and the write path retries `EntityNotFound` once. One race remains with import nostr, which takes no C1 (non-blocking 4).
- [x] **Security.**
  - Input is checked at the boundary: `concept` by `N.keyInput`, and `target` as a string of at most 2048 characters, then by `targetOf`.
  - Every Cypher value is a parameter. The only text spliced in is `keyNode`'s constant fragment.
  - Access is enforced by the route layer (DS10, WS13, DF8).
- [x] **Real Neo4j.** The live check ran the committed code on a scratch stack's Neo4j, covering the self-loop `MERGE`, `REFERENCES` to a held header, `nodeAt`, `addTags` and history.
  - The stack holds a `nostrEventTag_uuid` uniqueness rule (`tmp/live-check-48/setup.log`). A new tag's uuid hashes its header's address, the tag and its index. So a clash needs a tag node with the same `b` at the same index still in the graph, and while that tag is on the header, the repeat check answers first.
  - The placeholder `CREATE` and the marker removal didn't run on a real Neo4j (non-blocking 5).

## House rules check

- [x] Concept Graph API authority respected: domain writes go through the operations catalog, with no raw Cypher route added.
- [x] No new lint, typecheck or build tooling.
- [x] No harness-definition path changed (`scripts/harness-def-paths.txt`), so no CHANGELOG row is due.

## Product-guide adherence *(when the story traces to a PRD)*

- [ ] _Not applicable: no PRD. The book's anchor is an acceptance frame._

## Findings

### Blocking

None.

### Non-blocking

1. **`src/operations/rules/relationship-type-allowed.js:48-53`: add-relationship's refusal of `REFERENCES` still names only import nostr.**
   - **What it says.** `REFERENCES` takes its maker from firmware's `nostr` category, so the refusal reads: "REFERENCES is reserved: it is made by import nostr, with the checks it needs." This was checked by running the rule.
   - **What changed.** `graph declare-shared` and `wire-to-shared` now make `REFERENCES {source:'b-tag'}`, and an agent that reaches for add-relationship to affiliate a concept isn't pointed at them.
   - **Precedent.** Story 19 named `ENUMERATES`' makers in `FIRMWARE_MADE`, pinned by EN28 (`test/operations/graph/enumerate.test.js:599`). ADR 0048 didn't ask for the same here.
   - **Optional improvement:** a `REFERENCES` entry naming both makers, such as "import nostr; graph declare-shared and wire-to-shared, from a b tag", with a test like EN28, in a later story.
2. **`protocols/drafts/inherit-from.md:4`: the implementation note reads as though all three draw a relationship.**
   - **What it says.** "...each drawing the relationship the import derives". defer-sharing draws none, as `BIBLE.md:1854` and the catalog's row say.
   - **Optional improvement:** "the two pointer writes each draw the relationship the import derives; the marker draws none".
3. **`BIBLE.md:1854`: the placeholder's description covers only the one the write makes.**
   - **What it says.** "...to a placeholder (a `NostrEvent` with no `created_at`) when the graph doesn't hold the target".
   - **What the code does.** Under Amendment 1 item 1, a target held only by a placeholder isn't held, and the relationship runs to that placeholder. It may be seed-firmware's kind, a `TapestryNode` with no `NostrEvent` label (WS3, NEWT).
   - **Optional improvement:** "to the placeholder there, or to one it makes (a `NostrEvent` with no `created_at`) when no node is at the address".
4. **`src/operations/catalog/graph/_dispositions.js:163-173`: a wire's placeholder can race an import of the same address.**
   - **The race.** `nodeAt` finds no node, and the `CREATE` follows. Import nostr takes no C1 lock, so an import that commits a node at that address in between makes the uniqueness rule fail the wire.
   - **What happens then.** The wire answers 500 and rolls back whole. Import nostr re-runs its event in the same case (`src/operations/catalog/import/_letters.js:326-330`), and the wire doesn't.
   - **Why it doesn't block.** It is rare and safe: nothing is half-written, and a retry finds the node the import made and runs to it.
   - **Optional follow-up:** re-run the wire once on that constraint failure.
5. **The live check (`tmp/live-check-48/by-hand.log`) never exercised the placeholder `CREATE` (`_dispositions.js:154-157`) or the marker removal (`:133-138`) on a real Neo4j.** Its only wire was to a held header, and no marker was taken out.
   - **Why it doesn't block.** Both statements have shapes production already runs: import nostr's `HOLD_ADDRESS` (`_letters.js:331-335`) and update-concept's tag removal. Both are pinned on the Cypher engine, with Tapestry's uniqueness rules: WS2 and WS3 for the placeholder; DS6, WS6 and DF5 for the marker.
   - **Optional:** in the next live check, or before the first wire on david.tapestry.ninja, wire to an address the graph doesn't hold and declare a deferred concept.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. **The Implementer's hand-built list of 48 suites left out seven the final diff brings in.**
   - **Which seven.**
     - `concepts-list-shows-concepts-with-no-event` reads the changed `nostr-event-lookups-kept.json`.
     - `publish-export-a-concept` RE1 scans every file under `src/operations` for relay publishers: D1's sentinel for the new files.
     - `close-unauth-write-surface`, `dictionary-edit-concept`, `firmware-nodes-hold-their-concepts-keys`, `config-parse-leak` and `assistant-taggings-publish` each scan all of `src/`.
   - **No harm this time:** all seven pass.
   - **No new row.** This is another sighting of ledger row `2026-11-21-scoped-gate-lists-built-by-hand`, which is OPEN on staging and not yet on this branch. The row can take this sighting once the branch has merged.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place, and its `Review:` line points here.
- [x] Completion detection performed; the result and any book arithmetic go in the chat, not in this file. `/close-book` is offered only if the book looks complete.

---

## Round 2 — the fixes for round 1's findings

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-22
**Diff:** `git diff c23552a8..cd217e17`: 10 files, +308 −16. Round 1's review was committed as `c23552a8`. The owner chose "Fix findings first", and four commits followed:
- `3c398d99`: ADR 0048 Amendment 2, which answers the five findings. The owner ratifies it at this gate;
- `e0830e8d`: the tests first, in the Tester's lane: WS19, WS20, the kept-lookups entries for the new lines, and `cypherGraphFake`'s `meanwhile` entries learning `query`. The test plan gains "Added at review round 1's findings";
- `59cca43f`: the fixes in `relationship-type-allowed.js` and `_dispositions.js`, the two docs, and the story's Deviations. No file under `test/` changed;
- `cd217e17`: the story's Evidence of the live checks after the fixes.

**How it was made.** As in round 1:
- every suite ran through the session's wrapper, with `test/operations.test.js` alone;
- the rest of the list was derived from the diff;
- no stack was booted, and `npm test` never ran.

The derivations (`derive3.js`, `derive5.js`), the list (`suites-r2.txt`), the gate script (`gate-r2.js`), the mutation scripts (`mutate.js`, `run-mutations.js`) and the runs' output are in the ignored `tmp/review-48/`, and the run records are in `tmp/gate-runs/`. `git status` was clean after every run, and the independent check (P13) wasn't applied.

**Verdict:** PASS. Each of round 1's five findings is answered as Amendment 2 says. The new tests pin both code fixes, and each fails without its fix. One new non-blocking finding, about two of Amendment 2's examples.

### Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`) was not run, for round 1's reason. CI's stack-free job runs it on the pull request.
- [x] **`test/operations.test.js` alone,** at `cd217e17` on a clean tree:

  ```
  20261122T013602Z-86922-9e26 [review-48-r2-operations] started 2026-11-22T01:36:02.609Z on cd217e17 — PASS, exit 0, 1556 passed, 0 failed, 20 skipped, 1/1 suites · …/tmp/gate-runs/20261122T013602Z-86922-9e26.json
  ```

  That is round 1's 1,554, with WS19 and WS20. Inside it, wire-to-shared passes 20 of 20, `tapestry-key-paths` 20 of 20 (G9, G11 and G18 among them), the rule suite 10 of 10 and add-relationship 12 of 12. declare-shared, defer-sharing, the export cases and the agent suite pass as in round 1: 14, 11, 6 and 1.
- [x] **The rest of the scoped gate,** 57 suites in one `runGate`:

  ```
  20261122T014218Z-7063-db3e [review-48-r2-scoped] started 2026-11-22T01:42:18.317Z on cd217e17 — FAIL, exit 1, 1732 passed, 10 failed, 88 skipped, 57/57 suites; failed: safe-to-merge-check, router-stream-limit-on-connect · …/tmp/gate-runs/20261122T014218Z-7063-db3e.json
  ```

  The record names the ten failures, and they are again exactly this Mac's: `safe-to-merge-check` B1–B3, B5, B6, B8 and B9, and `router-stream-limit-on-connect` P1–P3. The other 55 pass, among them `graph-rules-builder` (26), `firmware-element-sync` (21), `graph-rule-firmware` (13, 4 skipped), `external-cli` (53) and `concepts-list-shows-concepts-with-no-event` (10, 5 skipped). The totals match the story's Evidence.
- [x] **The merge with staging,** checked again because `wire-to-shared.test.js` changed. The five new suites, loaded and run in one process on Node v22.23.1 (`r2-env-check-node22.txt`), changed no `process.env` key at load or after their runs, and all 52 tests passed, wire-to-shared now 20.
- [ ] _Playwright, lint, typecheck and build: not applicable or not configured, as in round 1._

**How the list was derived.**
- **What it holds:** round 1's 55, plus every registered suite that names a file this diff changed.
  - The rule file brings in `graph-rules-builder` and `firmware-element-sync`. `graph-rule-firmware` was on the list already.
  - `test/helpers/cypherGraphFake.js`, the changed helper, is loaded, through any chain of helpers, only by `operations.test.js`, `external-cli` and `firmware-nodes-hold-their-concepts-keys`. All three were on the list (`derive5.js`).
  - `community-references-prune-builder` and `firmware-install-leaves-tags-once` reach the fake's engine, `cypherEngine.js`, which is unchanged, through `communityStep`, and never `cypherGraphFake.js`, so they stay off.
- **A scan I corrected.** A first scan (`derive3.js`) missed names written with `.js`, and a second (`derive4.js`) matched the string `'conceptGraph'`, a role name, as the helper. `derive5.js` counts only `require` calls and `helpers/<name>` paths.
- **Against the Implementer's.** The list matches the 57 the story's Evidence names.

### Each finding against Amendment 2

1. **Finding 1 → item 1: answered.**
   - **The code.** `FIRMWARE_MADE` gains `REFERENCES: 'import nostr, and graph declare-shared and wire-to-shared from a b tag'` (`src/operations/rules/relationship-type-allowed.js:47-49`).
   - **The words now.** Running the rule gives: "REFERENCES is reserved: it is made by import nostr, and graph declare-shared and wire-to-shared from a b tag, with the checks it needs."
   - **The pin.** WS19 asks for a 409 `reserved-type` from `relationship-type-allowed`, with all three makers named and nothing drawn. On the old words it fails, as the test plan's Verification records.
   - **The other pin holds.** The rule suite's `REFERENCES: /import nostr/` (`test/operations/rules/relationship-type-allowed.test.js:54`) still matches, and no test pins the old words exactly.
   - **The doc left alone.** `docs/GRAPH_RULES.md` §2 still calls `REFERENCES` "the import's", which stays true, and Amendment 2 leaves it so that no rule element is regenerated.
2. **Finding 2 → item 3: answered.** `protocols/drafts/inherit-from.md:4` now says the two pointer writes each draw the relationship the import derives, and the marker draws none.
3. **Finding 3 → item 3: answered.** `BIBLE.md:1854` now says that when the graph doesn't hold the target, the relationship runs to the placeholder at its address, or to one the write makes (a `NostrEvent` with no `created_at`) when no node is there. That matches `_dispositions.js:175-186`.
4. **Finding 4 → item 2: answered, by way (b).** The placeholder is merged (`_dispositions.js:165-168`), and `held` and `node` come from the merged node (`:181-184`). Right before the `MERGE`, `ADOPT` (`:158-159`) gives a node without the `NostrEvent` label at the address that label, as G9 asks. Both run only when `nodeAt` found no node (`:178-181`).
   - **Would the tests fail without the fix?** Yes, and only the ones that should: see the mutation runs below.
   - **The kept entries.** G9, which is static, passes with `ADOPT`'s literal right before the `MERGE`'s. G11 and G18 pass with the three new entries, each naming a whole line of the code exactly. None is stale, and the old `CREATE` entry is gone.
   - **On a real Neo4j.**
     - With the uniqueness rule on `NostrEvent.uuid`, a `MERGE` waits for a node another transaction is committing at that uuid, then matches it.
     - An import's `CREATE` that comes after the wire's `MERGE` fails its constraint, and import nostr runs the event again (ADR 0032, Decision 7.9). The stream's `buildImportCypher` merges, so it matches the placeholder.
     - That is Neo4j's documented behaviour for a `MERGE` under a uniqueness rule. LH2 ran the `MERGE` path on a real Neo4j, but no live check, LH2's or this review's, raced an import against a wire. WS20 pins that race on the Cypher engine.
5. **Finding 5 → item 4: answered.** LH2 passed 16 of 16 (`tmp/live-check-48/r2-lh2.out`), on a fresh scratch stack whose four new files match HEAD's by digest (`_dispositions.js` `85601a05`):
   - the merged placeholder, of import nostr's shape, with one `REFERENCES` into it, and a repeat that answers `already-wired`;
   - a deferred concept declared shared, with the marker taken out and its `tag-removed` recorded;
   - two wires at once, leaving one placeholder.

   LH1 passed again, 25 of 25, on the fixed code.

### Would the tests fail without the fixes? Run here, not read

`tmp/review-48/mutate.js` and `run-mutations.js` ran `wire-to-shared.test.js` through the wrapper, once per mutation, on a copy of HEAD in the session's scratchpad, never the worktree. Each mutation changes only the two fixed files, and all but the pre-fix one change a single line or entry. The suite derives its root from its own location, so each run used the copy's code, as the different results show.

| Mutation | Fails | Passes |
|---|---|---|
| none: HEAD, the control | — | all 20 |
| both files as before the fix (`a8432b7c`) | WS19, on the old words; WS20, on a 500: "Node(…) already exists with label `NostrEvent` and property `uuid`" | the other 18 |
| `FIRMWARE_MADE` without `REFERENCES` | WS19 | the other 19 |
| the adoption's call taken out | WS20: "each of the three placeholder statements … has the adoption statement … right before it" | the other 19 |
| the adoption run after the `MERGE` | WS20, the same | the other 19 |
| `held` taken from `nodeAt` again | WS20: "target.held and target.node come from the merged node" | the other 19 |

So each part of each fix has a test that fails without it, and nothing else fails. The copy was left at HEAD's code.

### The test helper's change weakens no suite

`test/helpers/cypherGraphFake.js:98`: an entry that carries `query` fires only at a statement whose one-line text also matches it. Without `query`, the new clause short-circuits, and `findIndex` picks the entry it picked before.
- The other users of this fake's `failures.meanwhile` pass no `query`: `nostr-order` (`:350`), `nostr-send` (`:627`), `cypher-engine` (`:197`), and the main runs of `declare-shared`, `defer-sharing` and `wire-to-shared`.
- The `meanwhile` that `concept-writes-take-header-lock` and others use, `{ at, graph }`, belongs to the other fake, `graphFake.js`, which didn't change.
- `oneLine` is defined in the file (`:52`).
- It came in the tests-first commit, in the Tester's lane, and the fix commit touches no test file.

### What the fixes could newly break

- **The guards on the new lines.** G9, G11 and G18 pass (`tapestry-key-paths` 20 of 20, inside the operations run).
- **The rule's words.** Only the rule suite's regex pins them, and it passes. `graph-rules-builder`, `graph-rule-firmware` and `firmware-element-sync` pass, and firmware's rule elements are unchanged.
- **The adoption.** It changes nothing when no node is at the address, and WS20 counts it running only when `nodeAt` found none. In a race it would give a node without the `NostrEvent` label that label, the trade `importEventDirect` makes. Only a writer that skips C1 could put one there (new non-blocking 1).
- **`held` in the race** is read from the node the `MERGE` lands on, which keeps Amendment 1 item 1's meaning.

### Findings, round 2

#### Blocking

None.

#### Non-blocking

1. **`engineering-team/decisions/graph-operations-first-slice/0048-declare-shared-wire-to-shared-defer-sharing.md:295` and `:312`: two of Amendment 2 item 2's examples of a racer can't race.**
   - **What it says.**
     - Line 295 names "another concept's wire" among the writers that can commit a node at the target's address between `nodeAt`'s read and the write.
     - Line 312 says the event-less node the adoption catches is "in practice seed-firmware's kind of placeholder", or else a node of the instance's own with no letter, "made at that address at the same moment".
   - **Why they can't.** Each of those writers takes C1 before anything else, so it waits for the wire's transaction to end and can't land in its window.
     - Another wire takes it by Decision 4 (`:149`: the three "go one at a time ... with each other").
     - Seed-firmware takes it at `src/operations/catalog/lifecycle/seed-firmware.js:148-149`.
     - Create-concept, the maker of a node of the instance's own with no letter, takes it at `src/operations/catalog/graph/create-concept.js:71`.
   - **Who can.** Writers that skip C1: import nostr, the stream's `buildImportCypher`, and today's routes through `importEventDirect`. Each makes a `NostrEvent`, which the `MERGE` matches.
   - **What it changes.** The code is right either way. The adoption is G9's rule, with little left to catch in practice. LH2's two simultaneous wires show the C1 serialization rather than a race, as `:329` half-says.
   - **Optional:** correct the examples when the owner ratifies Amendment 2, and the test plan's sentence on RACE2 with them.

#### Harness friction

1. None new. Round 1's sighting stands. This round's derivation needed three passes before its helper scan was right, which is more evidence for ledger row `2026-11-21-scoped-gate-lists-built-by-hand`'s script.

### Verdict
**PASS**

### On PASS
- [x] The story's `**Status:**` stays `Done`, and its `Review:` line still points here.
- [x] Completion detection, unchanged from round 1: the book isn't complete. That goes in the chat, not in this file.

---

## Round 2 fix check — commit `5e0bda69`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-22
**Diff:** `git show 5e0bda69`: 2 files, +7 −7, prose only.
- **ADR 0048 Amendment 2:** its three examples of the race, and its ratification.
- **The story:** one Deviation and one Evidence note.

No code or test changed. No registered suite reads either file: every mention under `test/` is a header comment. So no gate ran again, and harness-lint wasn't run, since neither file is a harness-definition path.

**Checked against the code:**
- **"Only an import can land in that gap"** (ADR `:295`). This holds.
  - **Another concept's wire** takes C1 first: `K.lock` is its first statement after the form check (Decision 4, `:149`; `wire-to-shared.js:62`).
  - **Seed-firmware** takes C1 first in its transaction (`seed-firmware.js:148-149`). Before a first install there is no concept-header to lock, but a wire then refuses `not-installed`.
  - **Create-concept's** first statement in `apply` is `K.lock` (`create-concept.js:71`). Only its guard's reads run earlier, and they make nothing.
  - **The importers** take no C1 lock: import nostr, the stream's `buildImportCypher` and `importEventDirect`. Each makes a `NostrEvent`, which the `MERGE` matches.
  - **Restore** runs in an offline window, so nothing runs beside it.
- **The adoption's "When it matters"** (`:311`). Its conclusion holds: during a wire, nothing can put a node without the `NostrEvent` label at the target's address. Its subject is narrower than it reads (non-blocking 1).
- **Item 4's two wires** (`:328`). This holds. Each wire's `K.lock` waits for the other's commit. The second's `nodeAt` then finds the first's placeholder, the one placeholder LH2 found.
- **The ratification** (`:330`) records the owner's answer at the round-2 gate. The gate's words aren't in the repo, so I take it as recorded. Its date is the commits' local date.

**Nothing contradicts it.**
- **In the ADR,** these agree with the corrected text:
  - Decision 4;
  - item 2's way (b) ("An import's own `CREATE` ... runs again");
  - "Why `nodeAt` still runs first" (`:308`);
  - the G9 sub-item.
- **In the story,** the Deviation (`:152`) and the LH2 notes (`:242-243`) say the same.
- **In the test plan,** the RACE2 sentence (`:157`, "the window the adoption closes") describes where the fake injects its node in WS20, which stays true of the test. It says nothing about which real writer could land there. That fits keeping WS20's second case as G9's pin.

### Findings

#### Blocking

None.

#### Non-blocking

1. **ADR `:311` and story `:152`: "the writers that make a node ... without the `NostrEvent` label" names only seed-firmware and create-concept.**
   - **Why that's narrower than it reads.** It is true for the one kind a target may have, 39998 (`_dispositions.js:106`; Decision 2). Four more writers make such nodes, without C1, but only at 39999 addresses:
     - create-element (`create-element.js:171`);
     - create-set (`create-set.js:234`);
     - add-property (`_properties.js:826`);
     - add-subset (`src/api/normalize/nodes.js:60`).
   - **Optional:** add "at a concept header's address" after "a node" in both places.

### Verdict
**PASS.** Round 2's finding is answered, and the corrected text is accurate against the code, apart from the optional precision above. The story's `**Status:**` stays `Done`.
