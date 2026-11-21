# Review: Story 34 — `export nostr`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-20
**Diff:** `git diff d4345ad7..39a9b8c5`: 38 files, +5716 −26. These are three local commits after `d4345ad7`, the ADR PR's last commit, already merged into staging:
- `823683c6`: the tests, the test plan and their helpers (18 files);
- `26712ded`: the implementation, the docs, the ledger row and the story's Deviations (21 files);
- `39a9b8c5`: the story's Evidence.

**Against:**
- the story, [34-export-nostr.md](../../stories/graph-operations-first-slice/34-export-nostr.md), as amended at Architecture;
- [ADR 0034](../../decisions/graph-operations-first-slice/0034-export-nostr.md): Decisions 1–12, the seven story amendments, and Amendment 1;
- the [test plan](../../stories/graph-operations-first-slice/34-export-nostr.test-plan.md);
- the live check's records in the worktree's ignored `tmp/live-check-34/`, read only (`keys.json` wasn't opened).

**How it was made.** A reviewer agent with no Edit access wrote this review at the session's request.
- It never ran `npm test` or `docker`, and made no call to any container (the scratch stack included), GitHub or Loom.
- Every suite ran stack-free. Stub `curl` (exit 7) and `docker` (exit 1) were first on `PATH`, every service endpoint and the conf file's Neo4j and Redis were on a dead port, `TAPESTRY_CONTAINER` was `no-such-container`, and `TAPESTRY_CONTAINER_PORT` was unset. The gate ran first, and each suite alone after it ended, never beside it.
- The gate and the suites ran on the shell's Node v24.18.0. Four suites ran again on Node 22.23.1, CI's and the container's major version.
- Its probes ran against the worktree's code, or a throwaway copy of HEAD. They are in the ignored `tmp/review-34/`, each with its `.out`:
  - `probe-re1.sh` (blocking 1);
  - `probe-order.js` (non-blocking 4);
  - `probe-md.js` (non-blocking 5);
  - `probe-lock.js` (the lockfile).

  The same folder holds the suites' logs, `suites.out`, `suites-node22.out` and the gate's output, `gate-r1.out`.
- `git status` was clean after every run.
- The independent check before the commit (workflow 5, P13) wasn't applied.

**Verdict:** CHANGES_REQUESTED: two blocking findings and eleven non-blocking.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`) was not run. On this Mac the local stack is the owner's live agent-memory instance, and the full suite writes to it. CI's stack-free job runs it on the pull request.
- [x] **The scoped gate:** CI's five entries for an operations change, plus RE1's suite, through `test/helpers/gateRunner.js`, at `39a9b8c5` on a clean tree. Its `npm run gate:status -- --label a10-34-review-r1` line, with the path shortened:

  ```
  20261121T014306Z-58530-ba74 [a10-34-review-r1] started 2026-11-21T01:43:06.576Z on 39a9b8c5 — PASS, exit 0, 1473 passed, 0 failed, 18 skipped, 6/6 suites · …/tmp/gate-runs/20261121T014306Z-58530-ba74.json
  ```

  By entry:

  | Entry | Passed | Failed | Skipped | Time |
  |---|---|---|---|---|
  | `operations` | 1,369 | 0 | 16 | 303 s |
  | `external-cli` | 53 | 0 | 0 | 12 s |
  | `openapi-coverage` | 13 | 0 | 0 | 2 s |
  | `admin-action-sweep` | 9 | 0 | 0 | 0.5 s |
  | `schema-save-finds-the-right-header` | 26 | 0 | 2 | 19 s |
  | `publish-export-a-concept` | 3 | 0 | 0 | 0 s |

  The totals match the Implementer's record `20261121T010128Z-88708-2efe`, which ran on an uncommitted tree (non-blocking 12).
- [x] **Each suite of `test/operations/export/` alone, then RE1's** (`tmp/review-34/suites.out`, `suites-node22.out`):

  | Suite | Node 24.18.0: passed / failed / skipped | Time | Node 22.23.1 |
  |---|---|---|---|
  | `nostr` | 15 / 0 / 0 | 5 s | — |
  | `markdown-links` | 9 / 0 / 0 | under 1 s | 9 / 0 / 0 |
  | `nostr-letters` | 11 / 0 / 0 | 7 s | — |
  | `nostr-links` | 6 / 0 / 0 | 4 s | 6 / 0 / 0 |
  | `nostr-send` | 16 / 0 / 0 | 19 s | 16 / 0 / 0 |
  | `nostr-own` | 5 / 0 / 0 | 7 s | 5 / 0 / 0 |
  | `nostr-agent-through-cli` | 1 / 0 / 0 | 2 s | — |
  | `nostr-live` | 0 / 0 / 6 (its live checks skip, as they should) | 0 s | — |
  | `test/publish-export-a-concept.test.js` | 3 / 0 | 0 s | — |

  That is 63 feature tests passing, and RE1's suite, as the Evidence says. The harness's child runs on the parent's binary (`graphOpsSuite.js:79`), so the Node 22 column covers the catalog's code too, ES16's dropped connection included.
- [x] **`bash scripts/harness-lint.sh`:** clean, 0 violations, before this file and with it.
- [ ] _Playwright: not applicable (no UI)._
- [ ] _Lint, typecheck and build are not configured._

## Spec adherence

| AC | Tests, all passing | Holds |
|---|---|---|
| AC1 publish a scope | ES1–ES3, ES11–ES16, EN2; live LV1 | yes |
| AC2 a letter says what the graph says now | EL1–EL7, EL10, EL11 | yes |
| AC3 links, whole values, references | ML1–ML9, EK1–EK6 | yes, but for a text that starts with a byte-order mark (non-blocking 5) |
| AC4 whose nodes it signs | EL8, EL9 | yes |
| AC5 order, dry run, repeat | ES4–ES10, EL11; live LV2, LV3 | its rule, yes; its example, no (non-blocking 4) |
| AC6 its letters never come back | EW1–EW5; live LV4, LH2 | yes, but after a race or an unread read-back (non-blocking 3) |
| AC7 refusals, surface, agents | EN1–EN15, EA1, RE1; LH1 by hand (20 of 20) | not yet: no outside relay (blocking 2) |

- [x] **Every acceptance criterion has passing tests.** Every id in the plan's coverage map is in its suite: EN1–EN15, ML1–ML9, EL1–EL11, EK1–EK6, ES1–ES16, EW1–EW5 and EA1, with LV1–LV6 live (6 passed on the scratch stack, `tmp/live-check-34/nostr-live.log`). The AC6 cases pair each letter turned away with a newer one the same handler imports, so none passes by an early return (`nostr-own.test.js:80-125`).
- [ ] **No criterion is silently dropped.** AC7's scratch-stack run hasn't sent to an outside relay (blocking 2). Two others hold only in part: AC5's example (non-blocking 4) and AC6 in a race (non-blocking 3).
- [x] **No behaviour beyond the story** but the logged deviations, judged below, and one unlogged (non-blocking 13).

### The 19 deviations (the brief's item 2)

Each was checked against the code. Accepted means an Implementer's judgment call that needs no amendment.

| # | Deviation | Judgment |
|---|---|---|
| 1 | `everything` counts only when `true` | Accepted: Decision 1's input is `everything: true` (`nostr.js:177`). |
| 2 | The refusals' order, with the key last; a dry run needs the key | Accepted. No criterion orders them, and a dry run classes nodes by the assistant's pubkey, which comes from the key (`nostr.js:240, 260`). |
| 3 | Relays named as `new URL()` gives them, once each; 2,000 characters each; no list bound in the schema | Accepted: Amendment 1 item 2. `too-many-relays` is checked before any URL is parsed (`nostr.js:196`). |
| 4 | A cursor tied to its scope; a page with nothing finished goes back to the call's `after` | Accepted: as reads.js ties a cursor to its list. |
| 5 | Classing stops at `SEND_CUTOFF_MS`, between batches of 100; `BUDGET_MS` bounds the read-back; `strfry import` is never cut | Accepted: Amendment 1 item 6. The import's own 60 s timer is non-blocking 7. |
| 6 | `MAX_SEND` counts signings; the page is cut and built again | Accepted. The loop ends, since each pass cuts the page shorter (`nostr.js:288-300`). |
| 7 | "Gets a letter in this call" means a new letter of the page | Accepted. A target the own relay then refuses leaves a link to an address with no letter, which the next export heals, as the deviation says. |
| 8 | A tag is left out whole when one of its values is | Accepted: a tag short of one element would shift the rest. |
| 9 | `d` from the address; a non-address `uuid` is `no-address`, an address with another key `not-own` | Accepted. It extends Amendment 1 item 4 in the safe direction: export never signs at an address that carries another key (`_letters.js:66-67`). |
| 10 | An unbuildable node reported `pointer-unresolved`, `where: json` | Accepted: Decision 4.5 names no code for it. |
| 11 | `unsent-reference` reads ten tags and a graph's two lists | Accepted. |
| 12 | The send order: Decision 2's naming tags, `concept-graph` added, `o` and `b` left out | Consistent with Decision 2's list, whose own cycle example needs `concept-graph`. But the order it gives contradicts AC5's example, and the deviation doesn't say so: non-blocking 4, for the owner. |
| 13 | The entry's `nodes` is its `keys`; `raced: true` | Accepted. `keysOf` takes each change's `node` (`changes.js:127`), so `graph history` finds the entry by each, and CHANGE documents `raced` (`changes.js:89`). |
| 14 | The three importers' replies; the guard looks up the letter's NIP-01 key and its id | Accepted. The UI's callers of event-update read only `success` (`DListOverview.jsx:89`, `DListItemNeo4j.jsx:400`, `DListRatings.jsx:274`, `DListItemRatings.jsx:199`), and the reading pages' `post` throws only on `success: false` or an `error` (`writeVerbs.js:46-53`), so the new reply breaks none. Its `/docs` entry is non-blocking 8. |
| 15 | An own relay that can't be read makes each node with an `id` `changed`, and nothing is recorded | Accepted as fail-safe. Its consequence, letters in strfry that no node records, is part of non-blocking 3. |
| 16 | A dry run's relay answers, its null `id` and `created_at`, and `sent` | Accepted. |
| 17 | The real `strfryImport` resolves whenever the import ran; killed at 60 s | Accepted, with non-blocking 7. |
| 18 | A class thread brings own nodes only; a graph's lists are kept whoever wrote them; graphs past the fourth level or the 50th are neither followed nor reported | The first two are accepted, and match the story's settled design. The silent cap is non-blocking 6. |
| 19 | micromark 4.0.2, exact; 27 packages in the lock | Accepted and verified: see ADR adherence. |

## ADR adherence

- [x] **Files match the implementation notes.** There are the seven new files: `nostr.js`, `_scope.js`, `_letters.js`, `_send.js`, `_record.js` and `_own.js` under `src/operations/catalog/export/`, and `src/lib/markdownLinks.js`. The changed files are `_relay.js`, `changes.js`, the three importers, and the package files. Nothing else under `src/` changed, and the implementation commit touches no test.
- [x] **Layering.** It is a write with `run`, not the write path (Decision 1). The seams are read through their objects at each call: the declaration's caps through `module.exports` (`nostr.js:151`), `sender.strfryImport`, `S.now()`, and `_relay.js`'s `open` and `connect`. `_relay.js` gains only `relay` on `open()`'s answer (`_relay.js:119`).
- [x] **The statements** are parameterized. Only relationship types reach a statement's text, each checked against `TYPE` first (`_scope.js:43, 56-64`).
- [x] **The new dependency** is the one Decision 7 authorizes: `micromark` `4.0.2`, exact (`package.json:79`), resolved from the npm registry. The lock adds 27 packages and removes nothing. Every added package is in micromark's dependency closure: `debug` and `ms`, the closure's other two, were there already. None is marked dev, and all are MIT (`tmp/review-34/probe-lock.out`). The Dockerfile installs from both files at image build (`Dockerfile:85-86`), and CI runs `npm ci`.
- **Decision by decision:**
  - **1:** the declaration, its six inputs and its eleven refusals (`nostr.js:98-170`). It honors Amendment 1 items 2 and 3: relays zero to ten, `too-many-relays` in `run` (`:196`), and `unknown-ref` for a key no node has (`:225-228`).
  - **2:** the three scopes, the ranks, the caps and the cursor (`_scope.js`; `nostr.js:25-28`). Non-blocking 4 and 6 apply.
  - **3** and Amendment 1 item 4: `classOf` (`_letters.js:57-69`).
  - **4:** tags from tag nodes, `s` from parents, stamps, the stored JSON less `graphContext`, the order (`_letters.js:123-239, 358-391`).
  - **5:** the compare (`_letters.js:397-412`), and `created_at` the later of now and the last letter plus one (`nostr.js:329-330`).
  - **6** and Amendment 1 item 6: the own relay first and read back, then the relays named, local-only mode, eight in flight, 5 s each (`_send.js`; `nostr.js:334-351`). Non-blocking 7 applies.
  - **7:** the helper (`markdownLinks.js`), and the decisions it takes (`_letters.js:263-310`). Non-blocking 5 applies.
  - **8:** the record (`_record.js`). Non-blocking 3 applies.
  - **9** and Amendment 1 item 1: the reports (`_letters.js:419-552`). Non-blocking 13 applies.
  - **10:** `holdsLetterOrNewer` (`_own.js`), before the destructive step in each importer: `eventSync.js:363`, `io.js:502`, `tapestryBrainWrite.js:70`. Non-blocking 3 applies.
  - **11:** the exclusion and the header line are in, but RE1 doesn't catch a publisher built the same way (blocking 1).
  - **12:** as coded, with non-blocking 3.
  - **Amendment 1 item 5,** the answer's fields: as named. The counts take import nostr's camelCase for a hyphenated outcome (`notOwn`, as import's `notFound`).

## Concept-graph integrity

- [x] **Handles.** No handle or pubkey literal was added. The graph concept's address comes from `conceptUuid('graph')`, which reads the assistant's key at run time (`firmware.js:201-210`).
- [x] **Firmware reinstall:** not needed. No concept definition changed, and `firmware/` is untouched (ADR Consequences).
- [x] **Orientation:** not applicable. The code reads the graph through the operations' seam, and the relationship types from firmware's files.

## Things tests can't catch

- [x] **No secrets in committed files.** No run of 64 hex characters and no `nsec1` is on any added line. `tmp/` is ignored (`.gitignore:79`), and the diff holds no file under it. The fixtures' keys are the sha256 of fixed labels (`importFixtures.js:66-69`). The live check's `keys.json` is mode 600 in the ignored `tmp/`, and wasn't opened.
- [x] **No debug output.** No `console.*` was added under `src/`.
- [x] No commented-out code, and no TODOs.
- [ ] **Error paths.** An own relay that fails, refuses or doesn't answer, a `strfry import` that can't run, and a relay that drops the connection are each tested (ES12–ES16). Non-blocking 3 and 7 remain.
- [ ] **Concurrency.** Non-blocking 3.
- [x] **Security** (the brief's item 3):
  - **Who signs and sends.** `owner-and-admins` becomes the route table's `owner` (`routeTable.js:14`): the owner, admins and direct-local callers, as the owner answered catalog §10 question 2. EN2 refuses a visitor 401 and a stranger 403.
  - **The relay host guard** asks about every relay named, for every caller, before any ref is read (`nostr.js:209-214`; EN11, for the owner and an admin). The only loopback relay is the own relay, a constant no caller names (`nostr.js:34`, `_send.js:26`). Twelve loopback and private forms, as `new URL()` hands them to the guard, are each answered not public: `0.0.0.0`, `[::ffff:127.0.0.1]`, `[::]`, `[::1]`, `127.1`, `2130706433`, `0x7f.1`, `localhost`, `strfry.local`, `169.254.169.254`, `[fd00::1]` and `100.64.0.1`. DNS rebinding between the guard's lookup and the connect stays as story 32's review left it, and a rebound host would receive only letters that are public anyway.
  - **No hardcoded assistant pubkey.** The signer's pubkey comes from its key (`nostr.js:240`), and the instance's own keys from `ownKeys()` (`reads.js:147-150`).
  - **The unawaited send.**
    - In nostr-tools 2.10.4, `publish` calls `this.send` without awaiting it (`abstract-relay.js:377-389`).
    - `_relay.js` replaces `send` on the instance (`_relay.js:83-90`), so a send on a closed connection ends in `closeAllSubscriptions`, which rejects every open publish (`abstract-relay.js:208-216`).
    - `publishOne` checks `connected` before each publish (`_send.js:35`), and catches every publish's rejection, even one after its own timer (`:40`).
    - ES16 drives a real `AbstractRelay` against a loopback server that drops the connection at the second letter. It passes on Node 24.18.0 and on 22.23.1.
  - **Local-only mode** is read at each call (`nostr.js:338`; ES15).
  - **Only `_send.js` calls `.publish(`** under `src/operations/`, and the diff adds no other call. But RE1 doesn't hold that (blocking 1).
  - **Bounds.** Refs are capped at 1,000 characters, a cursor at 4,000, and each relay at 2,000, with ten relays at most. A call classes 2,000 nodes and signs 500 letters at most, and stops sending at 30 s, all as Decision 2 and 6 say. The exceptions are non-blocking 6 and 7.

## House rules check

- [x] Concept Graph API authority is respected.
- [x] No new lint, typecheck or build tooling. micromark is a runtime library the ADR authorizes (Consequences).

## Product-guide adherence

Not applicable: the story traces to no PRD, and it has no UI.

## Docs (the brief's item 6)

| Claim | Checked against | Holds |
|---|---|---|
| BIBLE §6: `id` and `created_at` become the letter's once the own relay accepted it, read back by id | `nostr.js:360-363`; `_record.js:24-28`; `_send.js:94-104` | yes |
| §6: a new version is dated one second after the last at the least; the `uuid` never changes | `nostr.js:329-330`; `_letters.js:360` (`d` from the address) | yes |
| §6: `sentTo` is `own` and each relay by URL; a re-send adds a relay | `_record.js:29-33`; `nostr.js:363-366` | yes |
| §6: nothing else changes, and no `NostrEvent` label | `_record.js:27` | yes |
| §6: "A node is set only while its `id` is still the one the export read; one another write gave a newer letter meanwhile is left as it is" | `_record.js:26` | the first half, but for the lock (non-blocking 3); "newer", no (non-blocking 10) |
| §6: the change entry's fields; `graph history` by each node; delete-node keeps `id`, `created_at` and `sentTo` | `nostr.js:363-365`; `changes.js:122-131, 144-156`; ADR Context 11 | yes |
| §6: who is signed, and what a letter carries | `_letters.js:57-69, 146-226` | yes |
| §6: "A letter export sent never comes back over its node" | `_own.js:34-49` | not after a race or an unread read-back (non-blocking 3) |
| §11's row: the scopes, the relays, the reports, outcomes and relay classes, the caps, `dryRun`, access, the command | the declaration (`nostr.js:25-49, 98-143`); EN2, EN3 | yes |
| §29: the rewrite, its forms, and what the node keeps | `markdownLinks.js`; `_letters.js:263-310`; EK4 | yes, but for a leading byte-order mark (non-blocking 5) and one sentence's order (non-blocking 11) |
| Catalog §6: who may call, the row, and "What an export does" | the declaration; its eleven refusals (`nostr.js:143`) | yes |
| Catalog §10, questions 2 and 9 answered | the story's open questions 2 and 3 | yes |
| Design doc §5, question 2: the record; "Its `by` is the caller"; the signing key is the address's, always the assistant's | `changes.js:134-156` (`byOf`); `_letters.js:66-67` | yes |
| Design doc §5, question 4 | the story's open question 3; `_letters.js:419-450` | yes |
| `clients/cli/skill/SKILL.md:9`: one operation publishes, and no other signs | of `src/operations/`, only `export/nostr.js` and `export/_send.js` hold `finalizeEvent` or `.publish(` | yes |
| Community-reference ADR 0004's header | RE1 (`test/publish-export-a-concept.test.js:136-144`); ADR 0034 Decision 11 | the exclusion and the widening, yes; "the second server-side publisher", no (non-blocking 9); RE1 holding "for every other module", not for a publisher built export's way (blocking 1) |
| Ledger `2026-11-20-moved-sets-leave-stale-z-tags` | story fact 3; ADR amendment 1; `link-set.js` and `unlink-set.js` exist; add-to-concept, remove-from-concept and move-element handle `wordTypes` | yes |

## Findings

### Blocking

1. **`test/publish-export-a-concept.test.js:144` — RE1 doesn't catch a third publisher built the way export's is, which ADR 0034 Decision 11 says it does.**
   - **The promise.** Decision 11: "Export's `publish` call sits in its own `_send.js` … so the exclusion covers it, and a third publisher built the same way elsewhere is caught." RE1's own comment says the same (`:137`), and ADR 0004's new header line says "the posture and RE1 hold for every other module".
   - **Why it doesn't hold.** RE1 flags a file only when it names `SimplePool`, `AbstractRelay` or `Relay` and calls `.publish(`. As built, `_send.js` takes its relay from `_relay.js`'s `open()` (`_send.js:118, 123`), which now hands out the connected relay (`_relay.js:119`), and names none of the three. So the very file RE1 is meant to catch passes it, wherever it is copied.
   - **Reproduced.** `tmp/review-34/probe-re1.sh` puts two copies of `_send.js` outside the two exclusions, in a throwaway copy of HEAD: `src/operations/catalog/graph/_third-publisher.js`, and `src/api/third/sender.js` with its two requires re-pointed. RE1 passes, 3 passed and 0 failed (`probe-re1.out`).
   - **The plan's evidence.** The test plan's Verification says "A third publisher, built the export's way under `src/operations/catalog/graph/`, failed RE1". That was true of Test Design's stub, which named the class. The sender as built doesn't.
   - **Asked change** (RE1 is Test Design's file):
     - make RE1 fail on a `.publish(` in any file under `src/api/` or `src/operations/` outside the two exclusions that reaches a relay through `_relay.js`'s `open()` or names a relay class. Simpler still: fail on any `.publish(` under `src/operations/` outside `catalog/export/`;
     - check it red first: a copy of `_send.js` under `src/operations/catalog/graph/` must fail RE1;
     - keep Decision 11's sentence and ADR 0004's header true of what RE1 then checks.

2. **`engineering-team/stories/graph-operations-first-slice/34-export-nostr.md:294` — AC7's run on a scratch stack is incomplete.**
   - **What AC7 asks.** The admin agent, through the external CLI on a scratch stack, exports "to the stack's own relay, and to one outside relay the owner chooses for the check", and "is refused a relay on a private address". The Evidence says both wait for the owner to choose the relay.
   - **What covers it now.**
     - EA1 runs the whole sequence stack-free, through the real CLI and catalog: `accepts.example.com` stands in for the outside relay, and `ws://10.0.0.1` is refused (`nostr-agent-through-cli.test.js:133-162`).
     - ES16 drives nostr-tools' real `AbstractRelay` against a loopback server.
     - But no letter has gone from an instance to a real outside relay, and that reach, a server-side publisher to the internet, is this story's new one.
   - **Asked change:** once the owner names the relay, run LH1's two remaining steps, the send and the private-relay refusal by hand. Record them in the Evidence, with each relay's answers as given. Or the owner amends AC7 to drop the outside relay.

### Non-blocking

3. **`src/operations/catalog/export/_own.js:44-46`, `_record.js:24-28` — after a race or an unread read-back, export's own newer letter can still come back over its node** (the brief's items 4 and 5; AC6).
   - **The race, which Decision 12 allows:**
     - two exports of one node overlap, and both read its `id`;
     - the second signs a second later, so its letter is newer (`nostr.js:329-331`);
     - the first is read back and accepted before the second's `strfry import`. The second then replaces it at the address, is read back and accepted too, and goes out to the relays named (`nostr.js:337-351`);
     - the first records. The second finds another `id` and is left `raced` (`_record.js:26`).

     The node now holds the older letter, while strfry and the relays hold export's newer one.
   - **What follows.** `holdsLetterOrNewer` answers no for that newer letter (`_own.js:44-46`). So event-update (`eventSync.js:363`, which the DList pages and the reading pages call), the I/O import (`io.js:502`) and the brain-write hook (`tapestryBrainWrite.js:70`) each import it as today. The node's tags are then deleted and remade from a letter whose `tapestry:` links are rewritten, dropped to their text, or left out. That is what AC6 forbids, and BIBLE §30 says no import may destroy such state. It lasts until the next export, which finds the node's letter gone from the relay, answers `changed`, and signs again.
   - **The same without a race.** An `unread` letter is in strfry, newer than the node's, and recorded nowhere (Decision 6; `nostr.js:361`; deviation 15). A `strfry import` killed at 60 s ends the same way (non-blocking 7).
   - **The optimistic check isn't a lock.** Under Neo4j's read-committed isolation, the `WHERE` reads `n.id` without the node's lock. Cypher takes the lock before a read only when the `SET`'s own right side reads the node (Operations Manual, "Concurrent data access", lost updates). So two records that read the same `id` can both pass it, and the later overwrites the earlier with no `raced`. That is worth confirming on the scratch stack with two interleaved transactions.
   - **What the tests see.** LV5 checks that both calls answered and that each node ends with an `id` (`nostr-live.test.js:149-153`). It doesn't look at `raced`, at the letter strfry holds, or at a later event-update, and the plan leaves `raced` unpinned on purpose.
   - BIBLE.md:377 and :380 state both promises without this caveat.
   - **For the owner** (it touches Decisions 8, 10 and 12, so it needs an amendment). For example:
     - the guard also turns away a letter whose id a `letter-sent` change records for that node: raced letters are already in the entry, and an `unread` letter's id would be added;
     - or the record takes the node's lock before it compares, and keeps the NIP-01-newer letter when two exports race;
     - or a ledger row names the window.

4. **`src/operations/catalog/export/_scope.js:46` — the send order puts a concept's header after four of its core nodes, where AC5's example has it first** (deviation 12).
   - **AC5** (story:130): "each comes after the call's letters it names, such as a concept's header before its core nodes and elements."
   - **Observed.** `tmp/review-34/probe-order.js` exported the suites' `pet` concept graph, 20 letters, with the real code over the fixture world (`probe-order.out`):
     - the header went out 13th, after the superset, the three sets, four properties, the JSON schema, the properties set, the primary property and the property tree graph;
     - it went before the core nodes graph, the concept graph and the five elements.
   - **Why.** Decision 2's naming tags leave out `o`, through which each core node names its header (`_concepts.js:362`). Meanwhile the concept graph names the core nodes graph, and the core nodes graph names its nodes. So the rule holds by Decision 2's list, and ES8 checks it by that same list (`exportFixtures.js:585-594`), but the example doesn't hold. The deviation doesn't say so.
   - **For the owner to ratify:** amend AC5's example to what Decision 2 gives. Or count `o`: the header then goes first, and its core nodes after it in key order, as one cycle.

5. **`src/lib/markdownLinks.js:49-50` — a text that starts with a byte-order mark keeps its `tapestry:` links in the letter.**
   - **The cause.** micromark's preprocess skips a leading U+FEFF, so every offset it gives is one short of the string's index, and `scan` slices the original string with them.
   - **Observed** (`tmp/review-34/probe-md.js`):
     - after a leading BOM, an inline link, a definition and an autolink give the destinations `(tapestry:…`, ` tapestry:…` and `<tapestry:…`;
     - none of them starts with `tapestry:`, so none is rewritten or dropped, and the letter would carry each. AC3 says no letter carries `tapestry:`;
     - tabs in list items and blockquotes, CRLF, a NUL, an astral character and a BOM mid-text are all rewritten correctly (`probe-md.out`).
   - **Optional:** add one to each offset when the text starts with U+FEFF, with an ML case for it.

6. **`src/operations/catalog/export/_scope.js:231, 246` — a graph scope cut at four levels or 50 graphs says nothing of it** (deviation 18).
   - Graphs past the fourth level or the 50th are sent, but their lists aren't followed, and nothing in the answer says so. An agent that exports a large Tapestry can't tell it went out in part.
   - Import nostr names such graphs under `next.graphs` (BIBLE §11).
   - **Optional:** report the graphs not followed, or name them in `next`. A new report or field amends Decision 2 or 9.

7. **`src/operations/catalog/export/_send.js:28, 75` — a hung `strfry import` holds the call for 60 s, whatever is left of its 40.**
   - Amendment 1 item 6 keeps the import whole. But its kill timer doesn't look at the call's deadline, and classing may run to 30 s (`nostr.js:274`). So a hung import answers at about 90 s, past nginx's 60 s, where Decision 6 says "A call has 40 s … inside nginx's 60 s".
   - Its letters then come back `unread` and unrecorded, which feeds non-blocking 3.
   - **Optional:** kill at the call's deadline, with a short floor, since the read-back tells what strfry kept.

8. **`src/api/openapi.yaml:3618-3650` — `/docs` doesn't say that event-update now turns a letter away.** Its 200 answer lists `success` and `uuid` only, and its description says nothing of `unchanged` or `reason` (`eventSync.js:363-365`). **Optional:** a sentence, and the two fields.

9. **`engineering-team/decisions/community-reference/0004-publish-export-a-concept.md:5`, `src/operations/catalog/export/_send.js:4` and `test/publish-export-a-concept.test.js:136` — "the second server-side publisher".** ADR 0034 Decision 11 calls assistant-profile's `publishToRelays` "the second", and export "another". Story fact 9 lists three senders from the server before this one. **Optional:** "another server-side publisher", as Decision 11 says.

10. **`BIBLE.md:377` — "one another write gave a newer letter meanwhile is left as it is".** The record leaves a node as it is when its `id` differs at all (`_record.js:26`). In non-blocking 3's race, the letter that stays is the older one. CHANGE says "another letter" (`changes.js:89`). **Optional:** "another letter".

11. **`BIBLE.md:1991` — the sentence about what export finds reads as if those links are the ones it leaves alone.** It says: "…so a link in a code span or block is left as it is: inline links, images, autolinks, and reference definitions with the references that use them." **Optional:** name the forms it finds first, then the code-span exception.

12. **`engineering-team/stories/graph-operations-first-slice/34-export-nostr.md:265, 272` — the Evidence's gate didn't run on `26712ded`.**
    - Its record, `20261121T010128Z-88708-2efe`, names `823683c6` with 16 files uncommitted (`dirty: true`), while `26712ded` holds 21 files.
    - This review's clean run at `39a9b8c5` gives the same totals.
    - **Optional:** say so, or cite a clean run.

13. **`src/operations/catalog/export/_letters.js:508` — an unlogged deviation, and a right one.** `uncarried` counts a `b` tag as carrying `INHERITS_FROM` or `REFERENCES`, as import nostr makes them (`import/_letters.js:223-227, 583`). Decision 9's list of what carries a relationship names no `b`. **Optional:** a line in the Deviations.

### Harness friction

1. **Test Design checked RE1's bite against a stub that didn't have the sender's shape** (blocking 1).
   - The stub publisher named `AbstractRelay`.
   - ADR 0034's implementation notes had the sender take its relay from `_relay.js`'s `open()`, which names no class.
   - A sentinel's red-before-green needs checking against the shape the ADR prescribes, not a stand-in's.
   - That would be a `meta` row, if the owner agrees.

## On PASS (same commit)

Not applicable: the story's status stays `Approved`, and completion detection waits for a round that passes.

## Verdict

**CHANGES_REQUESTED**

## Round 2 — 2026-11-21 (HEAD `6c0fe228`)

The owner answered round 1 "Yes, as recommended". That became ADR 0034's Amendment 2 and the story's "Changed at Review". Round 1 was committed as `b4683b8c`. The round added four commits after it, each kept to its role's files:
- `0c1f2c4f`, the session's: Amendment 2 and the story's amendments (2 files);
- `d58a6889`, the Tester's: the round-1 tests, written first, their helpers, and the test plan's "Review round 1" (10 files, none under `src/`);
- `306ef882`, the Implementer's: the fixes, the doc fixes and the story's ten new Deviations (12 files, no test);
- `6c0fe228`, the story's Evidence of the live re-check (1 file).

`git diff b4683b8c..HEAD` is 23 files, +812 −131.

**How it was made.**
- **The same limits as round 1.** No `npm test` and no `docker`. No call to any container (the scratch stack included), GitHub or Loom. The scratch stack's records in `tmp/live-check-34/` were read only, and `keys.json` wasn't opened.
- **Stack-free, as the brief gives it.** Stub `curl` (exit 7) and `docker` (exit 1) were first on `PATH`, every endpoint and the conf file's Neo4j and Redis were on port 9, `TAPESTRY_CONTAINER` was `no-such-container`, and `TAPESTRY_CONTAINER_PORT` was unset. The gate ran first, and each suite alone after it ended, never beside it.
- **Node.** The gate and every suite ran on Node v24.18.0. The six suites the round changed ran again on 22.23.1, CI's and the container's major version.
- **Fresh claims.** Each fix was re-derived from the code, a command or a probe. Neither the commit messages, the Evidence nor round 1's wording was taken as given.
- **Records** are in the ignored `tmp/review-34-r2/`. They hold the gate's output (`gate-r2.out`), the suites' (`suites-node24.out`, `suites-node22.out`, `importers-node24.out`) and the red check (`red-check.sh`, `.out`). Three probes are there with their `.out`: `probe-re1.sh` (finding 1), `probe-record.js` (finding 3) and `probe-kill.js` (finding 7).
- **The worktree.** `git status` was clean after every run.
- **The independent check** before the commit (workflow 5, P13) wasn't applied.

### Gates (run by the reviewer at `6c0fe228`)

- [x] **The scoped gate:** the six entries through `test/helpers/gateRunner.js`, on a clean tree. Its `npm run gate:status -- --label a10-34-review-r2` line, with the path shortened:

  ```
  20261121T040423Z-5654-a5b0 [a10-34-review-r2] started 2026-11-21T04:04:23.094Z on 6c0fe228 — PASS, exit 0, 1480 passed, 0 failed, 18 skipped, 6/6 suites · …/tmp/gate-runs/20261121T040423Z-5654-a5b0.json
  ```

  By entry:
  - `operations` 1,376/0/16 (301 s);
  - `external-cli` 53/0/0 (11 s);
  - `openapi-coverage` 13/0/0 (2 s);
  - `admin-action-sweep` 9/0/0 (0.5 s);
  - `schema-save-finds-the-right-header` 26/0/2 (19 s);
  - `publish-export-a-concept` 3/0/0 (0 s).

  That is seven more than round 1's 1,473, all in `operations`: the round's seven new tests. The record names `6c0fe228` with `dirty: false`. The Implementer's record the Evidence cites, `20261121T034436Z-32410-17ad`, gives the same totals on `d58a6889` with 12 files uncommitted, as the Evidence says (story:326).
- [x] **Each suite alone,** after the gate:

  | Suite | Node 24.18.0: passed / failed / skipped | Time | Node 22.23.1 |
  |---|---|---|---|
  | `nostr` | 15 / 0 / 0 | 5 s | — |
  | `markdown-links` | 10 / 0 / 0 | under 1 s | 10 / 0 / 0 |
  | `nostr-letters` | 12 / 0 / 0 | 7 s | 12 / 0 / 0 |
  | `nostr-links` | 8 / 0 / 0 | 6 s | 8 / 0 / 0 |
  | `nostr-send` | 19 / 0 / 0 | 23 s | 19 / 0 / 0 |
  | `nostr-own` | 5 / 0 / 0 | 6 s | 5 / 0 / 0 |
  | `nostr-agent-through-cli` | 1 / 0 / 0 | 2 s | — |
  | `nostr-live` | 0 / 0 / 6 (no scratch container, so its live checks skip) | 0 s | — |
  | `test/publish-export-a-concept.test.js` | 3 / 0 | 0 s | 3 / 0 |

  That is 70 feature tests passing: round 1's 63 and the seven new (ML10, EK7, EK8, EL12, ES17, ES18, ES19), as the Evidence says.
- [x] **The guarded importers' suites alone,** as the Evidence lists them:
  - `brain-first-tapestry-authoring`: 11 passed, its 8 live checks skipped;
  - `publish-event-signature-verification`: 5;
  - `b-tag-primitive`: 16;
  - `curated-dlist-update-publish`: 69.

  None failed.
- [x] **Red before green** (`red-check.sh`). A copy of HEAD had its `src/` put back to `b4683b8c`'s, with its `node_modules` linked. The nine tests the plan's table lists fail there, and no others, each for the reason the plan records:
  - ML10: the offsets one short;
  - EK7: no report;
  - EK8: `tapestry:` left in the letter;
  - EW2: `action: updated`;
  - EW5: `false`;
  - ES8: the header after the property tree graph;
  - ES13: no entry;
  - ES17: the harness stopped at its own 15 s;
  - ES19: the node keeps the older letter.

  The pins EL12, ES14, ES18 and RE1 pass there, as pins should. The counts are markdown-links 9/1, nostr-letters 12/0, nostr-links 6/2, nostr-own 3/2, nostr-send 15/4 and RE1 3/0.
- [x] **`bash scripts/harness-lint.sh`:** clean, 0 violations, before this section and with it.
- [ ] _Playwright: not applicable (no UI). Lint, typecheck and build aren't configured._

### Spec adherence, as amended at Review

| AC | Round 1 | Now |
|---|---|---|
| AC1 | yes | yes, with `graph-not-followed` (EK7) |
| AC2 | yes | yes, a `b` tag carrying its relationship (EL12) |
| AC3 | but for a leading byte-order mark | yes (ML10, EK8) |
| AC4 | yes | yes |
| AC5 | its rule, not its example | yes, kind first (ES8) |
| AC6 | but after a race or an unread read-back | yes (ES13, ES18, ES19, EW2, EW5; live LV5) |
| AC7 | no outside relay | yes, as amended: EA1 stack-free; on the stack, LH1 on round 1's code and the private-relay refusal on HEAD's |

### Round-1 findings, re-checked

| # | Finding | Resolution | As Amendment 2 says |
|---|---|---|---|
| 1 | Blocking: RE1 misses a publisher built export's way | **Fixed.** `relayPublisher` (`test/publish-export-a-concept.test.js:91-96`) flags a `.publish(` beside a relay class or a require of a module named `_relay`. RE1 first checks that it flags `_send.js`'s own text (`:165`) and a `SimplePool` publisher (`:172`), then scans (`:175`). In `probe-re1.sh`, three copies of `_send.js` each fail RE1, which names the copy. Two are at round 1's places, `src/operations/catalog/graph/_third-publisher.js` and `src/api/third/sender.js` (its requires re-pointed). The third sits beside import's reader, requiring `./_relay`. HEAD as it is passes | item 6: yes |
| 2 | Blocking: AC7's scratch-stack run incomplete | **Settled by the owner** (item 7; AC7 at story:157-163). The private-relay refusal ran by hand on HEAD's code. The admin agent, through the unchanged CLI, was refused `private-relay` on `relays` for `wss://localhost:7777` (`tmp/live-check-34/r2-private-relay.out`). The rest of LH1 ran on round 1's code. On HEAD's, LV1–LV6 ran on the stack and EA1 ran stack-free | item 7: yes |
| 3 | A letter export sent can come back after a race or an unread read-back | **Fixed.** The record locks each node first (`_record.js:35-39, 89`), then reads what it holds (`:91`). It keeps the newest letter export sent (`:96-103`), and gives a replaced letter as `was` (`:112`). An `unread` letter goes in the entry, on no node (`nostr.js:364-366`). The guard asks the entries (`_own.js:43-56`; `_record.js:55-75`). ES13, ES19, EW2 and EW5 go red then green; ES14 and ES18 are pins; LV5 ran live. `probe-record.js` confirms each case. Residuals: findings 14 and 15 | item 1: yes |
| 4 | The header goes out 13th | **Fixed.** `sendOrder` goes rank by rank (`_scope.js:345-349`). `rankOrder` orders within a rank by what each names, the ready groups by depth, then key (`:358-414`). ES8 goes red then green; AC5 is amended (story:130) | item 2: yes |
| 5 | A leading byte-order mark keeps `tapestry:` links | **Fixed.** After a leading U+FEFF, each offset moves on by one (`markdownLinks.js:52-54`). That is exactly what micromark 4.0.2's preprocess skips: one leading 65279 (`node_modules/micromark/lib/preprocess.js:51-56`). ML10 and EK8 go red then green | no item: an implementation fix |
| 6 | A graph scope cut short says nothing | **Fixed.** A graph past four levels (`_scope.js:250-253`), or left in the queue at the 50th, is reported `graph-not-followed` once, with the cap (`:267-279`). The enum gains it (`nostr.js:50`). EK7 goes red then green. See deviation 7 below | item 3: yes |
| 7 | A hung `strfry import` holds the call 60 s | **Fixed.** The import gets the call's time left, 30 s at most (`_send.js:32, 70, 83, 99`). `toOwn` waits 1 s more, and no longer (`:34, 101-105`). ES17 goes red then green. `probe-kill.js` ran the real `strfryImport` against a stub `strfry` that never exits. `toOwn` answered at its 2 s deadline, both letters `unread`. The import resolved at 1,503 ms with `SIGKILL`. No stub process was left after either | item 5: yes |
| 8 | `/docs` is silent on event-update's turned-away answer | **Fixed as asked:** a sentence and the two fields (`src/api/openapi.yaml:3624-3627, 3645, 3655-3660`). Both are true of `eventSync.js:363-364` | — |
| 9 | "the second server-side publisher" | **Fixed** in ADR 0004's header (`:5`), `_send.js:4` and RE1's comment (`test/publish-export-a-concept.test.js:156`). No copy is left in the tree. ADR 0004's line has finding 17 | item 6: yes |
| 10 | BIBLE.md:377's "newer letter" | **Fixed.** BIBLE.md:377 now says what the record does: the lock, the newest letter export sent, and `raced` otherwise. That is true of `_record.js:89-103`, but for finding 14's tie | — |
| 11 | BIBLE.md:1991's sentence order | **Fixed.** It names the forms it finds first, then the code-span exception | — |
| 12 | The Evidence's gate didn't run on `26712ded` | **Fixed.** story:292 says so and cites round 1's clean run. The round's own record (story:326) says it ran with the fixes uncommitted. This round's clean run gives the same totals | — |
| 13 | An unlogged deviation: a `b` tag carries a relationship | **Fixed.** It is logged (story:272) and ratified as item 4. `_letters.js:508` carries `INHERITS_FROM` for an inherit-typed `b` and `REFERENCES` for any other, as import nostr wires them (`import/_letters.js:227, 583`). EL12 pins it | item 4: yes |

### The ten new deviations (story:270-281)

| # | Deviation | Verdict |
|---|---|---|
| 1 | A `b` tag carries `INHERITS_FROM` or `REFERENCES` (story:272) | Accepted, and ratified as item 4. The `REFERENCES` half never changes a report: Amendment 1 item 1 leaves the `nostr` category's types out anyway. |
| 2 | The locks are taken in one statement, in tapestryKey order, in `_concepts.js`'s shape (:273) | Accepted. It takes the exclusive lock `lockNode` takes, held to commit ("The record's locks", below). |
| 3 | A letter no export sent is left, `raced` (:274) | Accepted. Item 1 speaks only of export's letters. Leaving another writer's letter is Decision 8's rule, and the next export answers `changed` and heals it. |
| 4 | A replaced letter is the change's `was` (:275) | Accepted: it is the letter the node held before. |
| 5 | An unread letter's change (:276) | Accepted, as item 1 says: in the entry, on no node, and found by `graph history` by its node. |
| 6 | The guard's entry check, for an own node with or without a letter (:277) | Accepted as behaviour: it can't be fooled (below). But "It reads only the `export nostr` entries whose `keys` hold that node" is true of what the statement returns, not of what Neo4j reads (finding 15). |
| 7 | `graph-not-followed` names the graph by key and name, not by address (:278) | **The report still names the graph**, as item 3 asks ("naming it and why"). Its `node` is the graph's tapestryKey. That is how all six older reports name their node, and `graph` takes it as a ref, so an agent can export the graph on its own as the words advise. The words add its name and the cap. **But the stated reason is the test's, not the design's.** EK7's `named` matches an address by substring, and a loose matcher shouldn't decide what the operation answers. So the helper should be tightened (finding 16, a test change for the Tester). After that, the report may carry `address` too, which the schema's field fits (`nostr.js:92`), at the owner's choice. Accepted as built. |
| 8 | The send order (:279) | Accepted: item 2's order, as `_scope.js:345-414` has it. |
| 9 | The import's time, `STOP_MS`, and no floor (:280) | Accepted: item 5 gives no floor. "The read-back never runs beside a live import" holds because the child is `strfry` itself, the compiled binary (`Dockerfile:35`), which SIGKILL ends at once. A wrapper script would leave its own child running, and the read-back would then run beside it after `STOP_MS`. |
| 10 | A leading byte-order mark (:281) | Accepted: micromark skips one leading mark and no other. |

### The record's locks (the brief's item 3)

- **They serialize two records of one node.**
  - `LOCK` (`_record.js:35-39`) sets `tapestryLock` and takes it off in one statement, the shape of the concept writes' lock (`_concepts.js:624`). Setting a property takes the node's exclusive lock, and Neo4j holds it until commit or rollback. So a second record's `LOCK` waits there.
  - Its `HELD` read (`:91`) runs after the wait, in the same transaction, so it reads the first record's committed `id`. Its `sentByExport` reads the first record's entry, which committed with it.
  - That closes round 1's lost update, where both records' `WHERE` read `n.id` without the lock.
- **In one order.**
  - `keys` is sorted (`:86`), and one `UNWIND` takes the locks row by row in that order.
  - Every record takes all its locks in that first statement, before any other write. `probe-record.out` shows the lock first in every case, and keys given as 3, 1, 2 locked as 1, 2, 3.
  - So two records can't wait on each other in a cycle.
  - A record and a graph write can still deadlock, as any two writers can. Neo4j then fails one, and `executeWrite` runs it again (`src/operations/graph.js:8-10, 47`). The record's work does nothing outside its transaction.
- **On a real Neo4j** (`tmp/live-check-34/nostr-live.log`, 03:53:57Z):
  - LV5 fired two exports of one fresh concept together, from one process in the container. Both answered 200, and every node ended with a letter. LV6 accepted 497 letters in 2.03 s.
  - The stack's seven export files hash as HEAD's (`r2-setup.log`, 03:53:02Z). Each source file was last written by 03:42:42Z, before the control panel restarted at 03:51:40Z, so the stack ran this code.
  - LV5 shows the statements run with no failure. It doesn't show the wait, or which branch the second record took.

### The guard's entry check (the brief's item 4)

- **It can't be fooled into turning away a letter no export sent.**
  - It answers yes only when an `export nostr` entry holds a `letter-sent` change whose `node` is that node and whose `now.id` is the letter's id (`_record.js:72`). The statement's `CONTAINS` only narrows the rows; the parse decides.
  - An id is the hash of its letter, so no other letter has it.
  - Only `_record.js` writes `export nostr` entries. It writes them for three kinds of letter: those the own relay accepted, those read back `unread`, and re-sends some relay accepted (`nostr.js:362-368`). A refused or unreachable letter is in none.
  - EW2 pairs the recorded letter with a newer one no entry records, which is imported.
- **Its read isn't bounded by a constant.** It scans every change entry (finding 15).

### The import's time and kill (the brief's item 5)

- **No orphan.** The child is the `strfry` binary, spawned without a shell (`_send.js:75`; `Dockerfile:35`). It is SIGKILLed at its time (`:83`), which ends it. `probe-kill.out` shows no stub process left after a kill.
- **No read-back beside a live import.**
  - The read-back starts when the import's child has closed.
  - It doesn't start once the deadline has passed (`:114`). So an import killed at the deadline leaves every letter `unread`, recorded in the entry and on no node.
  - `STOP_MS` matters only if a killed child takes more than 1 s to close.

### The order (the brief's item 6)

- **Kind first, then what each names within its kind.** `sendOrder` takes the ranks in order. `rankOrder` builds its graph from the names among one rank's letters only, so a name across ranks never holds a letter back. Ready groups go by depth, then key. That is item 2, and AC5 as amended.
- **ES8** reads the order the letters went into the own relay, and checks it four ways: the kinds never go back; within a kind, each letter goes after what it names; a cycle goes by key; pet's header goes before its twelve core nodes and elements.

### Docs (the brief's item 7)

| Claim | Checked against | Holds |
|---|---|---|
| BIBLE §6 (:377): the lock before the record reads the `id`; a node set while its `id` is the one read, or it holds an older letter export sent; the newest kept; a newer export letter, or one no export sent, left, `raced` | `_record.js:89-103` | yes, but for finding 14's tie |
| §6 (:378): the entry holds each letter some relay accepted, and each `unread` one, which no node records | `nostr.js:362-368`; `_record.js:82` | yes |
| §6 (:380): the three importers turn away a letter the node holds, an older one, or one an entry records, even a newer one | `_own.js:43-56` | yes |
| §11 (:610) and the catalog's row: `graph-not-followed` among the reports | `nostr.js:50`; `_scope.js:276` | yes |
| §29 (:1991): what it finds, then the code-span exception | `markdownLinks.js` | yes |
| `openapi.yaml:3624-3627, 3645, 3655-3660` | `eventSync.js:363-364` | yes |
| ADR 0004's header (:5): RE1 catches a `.publish(` on a relay made with a class, or got from `_relay.js` | `relayPublisher`; `probe-re1.out` | yes |
| ADR 0004 (:5): "the posture and RE1 hold for every other module" | `src/api/assistant/profilePublish.js:140, 154`; ADR 0034 Decision 11 | no: finding 17 |
| `changes.js:50-54, 89`: a `letter-sent` change for each letter a relay accepted or read back `unread`; `raced` when the node held a newer letter another export sent, or one no export sent | `nostr.js:362-368`; `_record.js:96-109` | yes, but `raced` is also given for finding 14's tie, and for a node deleted meanwhile |
| The declaration's description (`nostr.js:105-109`) and its result's (`:119`) | the code above | yes |

### Nothing beyond the fixes (the brief's item 8)

- **The fix commit** changes the 12 files the findings and Amendment 2 name, and no test.
- **The test commit** changes only test files and the plan. Its helper changes are additive: `relayFake.js`'s `hang`, `cypherGraphFake.js`'s `set`, and `exportFixtures.js`'s `timeoutMs`, `exportEntry` and `graphNode`.
- **The session's commits** change only the ADR and the story.
- `_letters.js` and the three importers are as round 1 left them.
- No added line holds key material, `nsec1`, console output or a TODO.

### Findings (round 2)

#### Blocking

None.

#### Non-blocking

14. **`src/operations/catalog/export/_record.js:98-102` — when two exports sign the identical letter, the second's change says `raced`, and its relays aren't added to `sentTo`.**
    - **How it happens.** Two exports of one node in the same second build the same tags and the same `created_at` (`nostr.js:330-331`), so they sign letters with the same id. LV5 fires two such calls.
    - **What the record does.** The second record finds the node holding that id. It isn't the id the call read, and it isn't newer than itself (`newer`, `:63`). So the change says `raced`, and `sentTo` stays the first record's. In `probe-record.out`, case E, `wss://b` accepted the letter and isn't added.
    - **Why it matters.** CHANGE (`changes.js:89`) and BIBLE.md:377 say `raced` means the node held a newer letter, or a letter no export sent. Neither is true here.
    - **What isn't lost.** The node holds this very letter. A later export naming that relay re-sends the letter unchanged and adds it.
    - **Optional:** treat a node that holds `l.now.id` as holding this letter, and add its relays as a re-send does, with no `raced`. A pin beside ES18 and ES19 would be the Tester's.
15. **`src/operations/catalog/export/_record.js:55-58`, `_own.js:54-56` — the guard's entry read scans every change entry.**
    - **Why.** The change entries are indexed on `at` and `byPubkey` only (`src/lib/tapestry-node-index.js:78-81`). So `MATCH (c:GraphChange {operation: $operation}) WHERE p.key IN c.keys …` is a label scan of every entry the instance has written, each graph write's included, for the one or two nodes the guard asks about.
    - **When it runs.** For each own letter that the node's own letter doesn't settle: one newer than the node's, or one at a node with no letter. That is the event-update after each edit on the reading pages and the DList pages (`ui/src/pages/reading/writeVerbs.js:280`, `ui/src/pages/lists/DListOverview.jsx:83`), the brain-write after each Tapestries edit, and each such item of an I/O import.
    - **What it costs.** It grows with the instance's history, not with the call. It is small today, and `graph history --node` filters entries the same way (`changes.js:205-213`). But it is now a step of three import paths, one scan per letter in a bulk I/O import.
    - **The record.** The deviation (story:277) says it "reads only the `export nostr` entries whose `keys` hold that node". That is what it returns, not what it reads.
    - **Optional:**
      - an index on `GraphChange.operation`, made at start beside `graph_change_at`, so the scan covers export's entries only. That adds to ADR graph-operations-foundation/0004 Decision 5's list;
      - or a ledger row naming the cost;
      - and either way, the deviation's wording.
16. **`test/operations/export/nostr-links.test.js:206` — EK7's `named` matches an address by substring, and that decided what the report says** (deviation 7; the Tester's).
    - **The matcher.** `named` falls back to `X.mentions(rep, uuid)`, which is `JSON.stringify(rep).includes(uuid)` (`test/helpers/exportFixtures.js:588`).
    - **What it does to the report.** `39999:<TA>:wide-w5` is a substring of `…:wide-w50`. So a `graph-not-followed` report carrying w50's address would also name w5, and EK7's "one report, naming one graph" would fail on a right answer. The Implementer, who may not change a test, left the address out.
    - **A second use.** EK7 reads its `not-found` checks by substring too, and `…:wide-missing-1` is inside `…:wide-missing-10` to `-19`. So "the other 49 graphs' lists are followed" can pass for w1 when w1's list wasn't read.
    - **Optional:** compare whole values, `rep.node === key || rep.address === uuid`, and the same for the `not-found` addresses. The report may then carry `address`, at the owner's choice.
17. **`engineering-team/decisions/community-reference/0004-publish-export-a-concept.md:5` — "the posture and RE1 hold for every other module" isn't true of `src/api/assistant/`.**
    - **The other publisher.** assistant-profile's `publishToRelays` sends EVENTs from the server to outside relays over `ws` (`src/api/assistant/profilePublish.js:140, 154`; assistant-profile ADR 0002, 2026-09-12), outside both excluded folders.
    - **RE1 can't see it.** It calls no `.publish(`, so RE1 doesn't flag it. ADR 0034 Decision 11 says both.
    - **The line contradicts itself.** It now calls export "another server-side publisher", which implies a third, then says the posture holds everywhere else. The dlist-curation line above it has said the same since 2026-09-10, two days before assistant-profile's ADR.
    - **Optional:** name assistant-profile's sender as the exception RE1 doesn't see, as Decision 11 does.
18. **`src/api/neo4j/eventSync.js:359-360`, `src/api/io.js:495-496`, `src/api/strfry/tapestryBrainWrite.js:65-67` — the guard's three call sites describe round 1's guard.**
    - **What they say.** Each says it turns away a letter the node holds, or an older one. The brain-write hook's adds "A newer one, such as an edit in the Tapestries UI, is imported as before".
    - **What it does now.** Since Amendment 2 item 1, a newer letter an `export nostr` entry records is turned away too (`_own.js:10-16`).
    - **Optional:** say so, or point at `_own.js`.

### Harness friction

1. **Round 1's item is still unrecorded.** Test Design checked RE1's bite against a stub that didn't have the sender's shape. The `meta` row round 1 proposed, if the owner agrees, isn't in OPEN.md yet.
2. **Finding 16 is another case of OPEN.md rows 116 and 174.** A test's proxy, here a substring matcher, stood against a right answer. The Implementer, who can't touch tests, shaped the output around it rather than sending the test back. That could be a line on row 174 rather than a row of its own.

### On PASS (same commit)

- [x] The story's `**Status:**` is flipped to `Done` in place. Its "Review:" link is already there (story:339).
- [x] Completion detection was performed. Its result is in the chat, not in this file.
- The commit is the session's: the Reviewer was asked to write this file and the story's status only.

### Verdict (round 2)

**PASS**
- **Both blocking findings are resolved.** RE1 now catches a publisher built export's way, shown on three copies of the sender. AC7's outside relay is the owner's amendment, and its private-relay refusal ran by hand on HEAD's code.
- **Each round-1 non-blocking finding is fixed** as Amendment 2 says. Where a test reads it, it is red on round 1's code and green on HEAD's.
- **The record's locks serialize two records of one node,** in one key order, so they can't deadlock each other.
- **Five non-blocking findings are new:**
  - 14: an identical letter is marked `raced`;
  - 15: the guard's read grows with the history;
  - 16: EK7's substring matcher;
  - 17: ADR 0004's header;
  - 18: three stale comments.
- **For the owner to ratify:** nothing new. Finding 14's fix is a judgment call inside Amendment 2 item 1. Finding 15's index would add to ADR graph-operations-foundation/0004 Decision 5's list.

## Round 3 — 2026-11-21 (HEAD `ee7a5245`)

Round 2 passed with five non-blocking findings, 14 to 18. The owner chose "Fix findings first", and the three that change a decision became ADR 0034's Amendment 3, to ratify at the next gate. Round 2 was committed as `adca099f`. The round added four commits after it, each kept to its role's files:
- `7bbf7d6c`, the session's: Amendment 3, and ledger row `2026-11-21-guard-test-checked-against-wrong-shape` (2 files);
- `8a445856`, the Tester's: the tests, written first, their helper, and the test plan's "Review round 2" (5 files, none under `src/`);
- `454e6c5e`, the Implementer's: the fixes, the doc fixes, the story's eight new Deviations and ledger row `2026-11-21-server-publishers-re1-cannot-see` (13 files, no test);
- `ee7a5245`, the story's Evidence of the live re-check (1 file).

`git diff adca099f..HEAD` is 20 files, +558 −156.

**How it was made.**
- **The same limits as rounds 1 and 2.** No `npm test` and no `docker`. No call to any container (the scratch stack included), GitHub or Loom. The live re-check's records in `tmp/live-check-34/` were read only, and `keys.json` wasn't opened.
- **Stack-free, as the brief gives it.** Stub `curl` (exit 7) and `docker` (exit 1) were first on `PATH`, every endpoint and the conf file's Neo4j and Redis were on port 9, `TAPESTRY_CONTAINER` was `no-such-container`, and `TAPESTRY_CONTAINER_PORT` was unset. Each suite ran alone first, then the gate, then the Node 22 runs and the red check. Nothing ran beside the gate.
- **Node.** The gate and every suite ran on Node v24.18.0. The same suites ran again on 22.23.1, CI's and the container's major version.
- **Fresh claims.** Each fix, deviation, doc sentence and ledger line was re-derived from the code, a command or a record. Neither the commit messages, the Evidence nor round 2's wording was taken as given.
- **Not run:** the guarded importers' own suites, which the brief doesn't list. The Evidence says they pass (story:353). EW2 to EW4 drive the three importers' real handlers over the guard.
- **Records** are in the ignored `tmp/review-34-r3/`:
  - the suites' script and logs (`suites.sh`, `suites-node24.out`, `suites-node22.out`, and one log a suite);
  - the gate's (`gate.sh`, `gate-r3.out`);
  - the red check (`red-check.sh`, `.out`);
  - `harness-lint-before.out`.
- **The worktree.** `git status` was clean after every run.
- **The independent check** before the commit (workflow 5, P13) wasn't applied.

### Gates (run by the reviewer at `ee7a5245`)

- [x] **The scoped gate:** round 2's six entries through `test/helpers/gateRunner.js`, on a clean tree. Its `npm run gate:status -- --label a10-34-review-r3` line, with the path shortened:

  ```
  20261121T053558Z-19823-84a9 [a10-34-review-r3] started 2026-11-21T05:35:58.409Z on ee7a5245 — PASS, exit 0, 1486 passed, 0 failed, 18 skipped, 6/6 suites · …/tmp/gate-runs/20261121T053558Z-19823-84a9.json
  ```

  By entry:
  - `operations` 1,382/0/16 (313 s);
  - `external-cli` 53/0/0 (12 s);
  - `openapi-coverage` 13/0/0 (2 s);
  - `admin-action-sweep` 9/0/0 (0.5 s);
  - `schema-save-finds-the-right-header` 26/0/2 (21 s);
  - `publish-export-a-concept` 3/0/0 (0 s).

  That is six more than round 2's 1,480, all in `operations`: the round's six new tests. The record names `ee7a5245` with `dirty: false` and no stray errors. The Implementer's record the Evidence cites, `20261121T051347Z-55527-b43b` (`a10-34-r2-fixes`), gives the same totals on `8a445856` with 12 files uncommitted, as the Evidence says (story:355). By its file times, the Implementer's suites ended before that gate started and the Node 22 runs began after it ended.
- [x] **Each suite alone,** before the gate:

  | Suite | Node 24.18.0: passed / failed / skipped | Time | Node 22.23.1 |
  |---|---|---|---|
  | `nostr` | 15 / 0 / 0 | 5 s | 15 / 0 / 0 |
  | `markdown-links` | 10 / 0 / 0 | under 1 s | 10 / 0 / 0 |
  | `nostr-letters` | 12 / 0 / 0 | 8 s | 12 / 0 / 0 |
  | `nostr-links` | 8 / 0 / 0 | 6 s | 8 / 0 / 0 |
  | `nostr-send` | 24 / 0 / 0 | 28 s | 24 / 0 / 0 |
  | `nostr-own` | 6 / 0 / 0 | 7 s | 6 / 0 / 0 |
  | `nostr-agent-through-cli` | 1 / 0 / 0 | 2 s | 1 / 0 / 0 |
  | `nostr-live` | 0 / 0 / 6 (no scratch container, so its live checks skip) | 0 s | 0 / 0 / 6 |
  | `test/publish-export-a-concept.test.js` | 3 / 0 | 0 s | 3 / 0 |

  That is 76 feature tests passing: round 2's 70 and the six new (ES20 to ES24, EW6), as the Evidence says (story:350).
- [x] **Red before green** (`red-check.sh`).
  - **The copy.** A copy of HEAD had its `src/` put back to `adca099f`'s, with its `node_modules` linked. That is `7bbf7d6c`'s `src/` too, since `git diff adca099f 7bbf7d6c -- src test` is empty.
  - **What failed.** The nine tests the plan's table lists fail there, and no others, each for the reason it records:
    - EW2: `action: updated`;
    - EW5: `false` for the listed letter;
    - EW6: 6 of its 17 statements are the entry scan;
    - EK7: the report has no `address`;
    - ES20: `sentTo` stays `['own']`;
    - ES21, ES22 and ES24: no `sentIds`;
    - ES23: Rex lists only the other export's letter.
  - **The counts** are nostr-own 3/3, nostr-links 7/1 and nostr-send 19/5, as the plan's table has them (test plan:304-306). ES1, ES18 and ES19, changed only in their fixtures, pass there, as the plan says.
- [x] **`bash scripts/harness-lint.sh`:** clean, 0 violations, before this section and with it. L15 reads both new ledger rows.
- [ ] _Playwright: not applicable (no UI). Lint, typecheck and build aren't configured._

### Findings 14–18, re-checked

| # | Finding | Resolution | As Amendment 3 says |
|---|---|---|---|
| 14 | Two exports signing the identical letter: the second says `raced`, and its relays aren't added | **Fixed.** A node already holding the call's own letter id goes the re-send's way (`_record.js:93-97`). `ADD_SENT_TO` adds the relays that accepted it (`:56-60, 104-108`). The change's `was` is what the node held, the same as `now` (`:97, 118`), and there's no `raced`. The node's lock, taken at `:83`, means `ADD_SENT_TO`'s `n.id = r.id` can't miss. ES20 runs the other export first on a copy with the same clock, so the two ids match by construction. It then commits that export's record just before this call's first write | item 1: yes |
| 15 | The guard's entry read scans every change entry | **Fixed.** Each node keeps `sentIds` (`_record.js:109-116`; `MAX_SENT_IDS` at `:39`). It gets the id of each letter a call signed that the own relay accepted (set, already held or raced) or that is `unread`. Each id goes in once, appended last, and past 20 the earliest drops. The guard has one statement: the node at the letter's address or id, with its `sentIds` (`_own.js:24-28, 43`). It answers yes when they list the id (`:48`). No change entry is read anywhere on the guard's path. In `_own.js`, `GraphChange` appears only in the `NOT n:GraphChange` filter. In `_record.js`, `SENT_BY_EXPORT` and `sentByExport` are gone, and nothing in the tree names them. On the importers' path, `factsOf` (`graph/_nodes.js:90-100`), `keyOf` (`import/_letters.js:125-133`) and `ownKeys` (`reads.js:147-150`) read no graph. The read seeks the `tapestry_node_uuid` index (`src/lib/tapestry-node-index.js:15`), so its cost doesn't grow with the history. EW6 pins the statements and the behaviour; ES21 to ES24 pin the list | item 2: yes, with "the newest 20" read as deviation 3 reads it |
| 16 | EK7's substring matcher decided what the report says | **Fixed.** EK7's `named` and `carries` compare whole values (`nostr-links.test.js:207, 209`), and so do its `not-found` checks (`:230`). The report carries the graph's `address` beside its key and name (`_scope.js:275-279`), and the schema's field says so (`nostr.js:92`) | item 3: yes |
| 17 | ADR 0004:5's "the posture and RE1 hold for every other module" | **Fixed as far as it goes.** Line 5 now says what RE1 flags: such a `.publish(` under `src/api/` or `src/operations/`, outside the two folders (`test/publish-export-a-concept.test.js:78-80, 91-96, 158-161, 175`). It names two senders RE1 can't see. **assistant-profile's `publishToRelays`** sends raw `EVENT` frames over `ws` and calls no `.publish(` (`src/api/assistant/profilePublish.js:140, 154, 192`). Five of the assistant's route files reuse it, and its ADR is dated 2026-09-12. **The NIP-85 publishers under `src/algos/nip85/`:** `publish_nip85_10040.mjs` sends to primal, hasenpfeffr and damus (`:347`), behind `POST /api/publish-kind10040-event` (`src/api/index.js:180`). `publish_nip85_30382.js` would send too, but nothing calls it now, and the kind 30382 publishers in use put their letters into the local strfry only. Each claim is true, but a third sender RE1 can't see is left out: finding 19 | — (docs) |
| 18 | Three guard comments describe round 1's guard | **Fixed.** Each names the case `sentIds` adds and points at `_own.js` (`eventSync.js:359-361`, `io.js:495-498`, `tapestryBrainWrite.js:65-68`). The brain-write hook's now says "Any other newer one … is imported as before". All three are true of `_own.js:43-54` | — (docs) |

### The eight new deviations (story:283-292)

| # | Deviation | Verdict |
|---|---|---|
| 1 | The same letter twice goes through the re-send's statement; `was` is what the node held, the same as `now` (:285) | Accepted. Under the lock, `ADD_SENT_TO` always finds the id, so its "else `raced`" never runs. `was` follows round 2's deviation 4: it is the letter the node held |
| 2 | `sentIds` lists only the letters a call signed; a re-send adds none (:286) | Accepted. A re-send's letter is the node's own (`nostr.js:369`, where `was` is `now`), and the guard's first check turns it away. If the node moved on meanwhile, it moved to a newer letter, and the re-sent one is older. ES21 pins "adds none" |
| 3 | "The newest 20" is the 20 latest recorded (:287) | **Accepted, after a hard look.** `sentIds` holds ids only, so the record can't order them by `created_at` without storing more. The two orders differ only when a raced letter records after a newer one it lost to: ES23's Rex lists `[newer, raced]`. That raced letter is older than the node's own, so NIP-01's order already turns it away. Within 20, the list's order never changes the guard's answer. Past 20, either reading drops a letter, and they differ only in which goes first. ES24 can't tell them apart, since its 21 letters record in `created_at` order. The docs say "newest" (finding 20) |
| 4 | The record locks and reads every node of its letters, an `unread` one's included (:288) | Accepted, and needed. `SET_SENT_IDS` writes a list worked out from `HELD` (`_record.js:61-65, 114`). Without the lock first, two records of one node could each read the same list, and the later would drop the earlier's id |
| 5 | Another export's letter is told by `sentIds` alone, and the entry read is gone. Only scratch stacks and suites hold export letters from before `sentIds`, "since export nostr hasn't been merged anywhere" (:289) | **Accepted, after a hard look.** The premise holds on this checkout's refs: no remote-tracking branch holds `26712ded`, and neither `origin/staging` (`b262a8c1`, 2026-11-21 04:47Z) nor `origin/main` holds `src/operations/catalog/export/`. What it can misjudge is a node holding an export letter its `sentIds` doesn't list. That happens to one recorded before `sentIds` (scratch stacks only), or one pushed out by 20 later records while the node still held it. A newer export letter for such a node is left `raced` rather than set. Raced letters are listed, so the guard still turns it away. strfry keeps only the newer version at the address, and export reads a node's letter by id (`_letters.js:228-237`). So the next export finds the node's letter gone and answers `changed` (`:399`). The cost is one re-sign, and AC6 isn't touched |
| 6 | The guard's `sentIds` check covers an own node at the address or keyed by the id, with or without a letter, before the letter is compared (:290) | Accepted (`_own.js:47-48`). EW5's pet's Tom pins the no-letter case. Both checks can only answer yes, so their order changes no answer |
| 7 | `graph-not-followed`'s `address` is the graph's `uuid`, left out when it has none (:291) | Accepted. The schema's `address` isn't nullable (`nostr.js:92`). A graph reached by an event id may have no `uuid`, and its words still name it by key |
| 8 | Wording beyond the brief's list, and ADR 0004's NIP-85 publishers (:292) | Accepted for the declaration, the catalog and `changes.js` (Docs, below). The ADR 0004 part is true of what it names. But its own reason, that "without them the new sentence would be wrong too", applies to a sender it leaves out (finding 19) |

### The guard that reads only `sentIds` (the brief's item 3)

- **It can't be made to turn away a newer letter no export sent.**
  - It answers yes for a letter the node holds, an older one, or an id the node's `sentIds` lists (`_own.js:48-52`). Only the third can fit a newer letter.
  - Only `_record.js` writes `sentIds` (`:61-65`). It writes only the ids of letters that call signed with `finalizeEvent` (`nostr.js:332, 361`), and nothing else in the tree names `sentIds`.
  - No generic property writer can reach it. Field mapping writes `<oKey>_<field>` (`graph/_fields.js:151-153`), the locks write `tapestryLock`, and the importers set named properties on a `MERGE`.
  - An id is the hash of its letter, so a letter with a listed id is the very letter export signed.
  - EW2 and EW5 each pair a listed letter with a newer one no list names, and the newer one is imported, or answered no.
- **It turns away every exported letter AC6 covers, as long as it is among the 20 latest recorded for its node.**
  - A letter newer than the node's own is one whose read-back didn't answer, or one a raced record left. Each is listed (ES22, ES23).
  - So the guard misses one only after its node has had 21 such records in a row, with no newer letter set between. The oldest is then dropped while it is still newer than the node's own.
  - Through event-update, which reads the newest version strfry holds at the address (`eventSync.js:72-80`), it would also take every later letter to have missed strfry.
  - Through the I/O import or the brain-write hook, someone would have to post that old letter back. A letter whose read-back didn't answer went to no other relay (`nostr.js:338, 345`).
  - Round 2's entry check had no bound. Amendment 3 accepts this one ("Twenty is enough"), but AC6 still says "any" (finding 20).
  - A record that failed outright leaves a letter neither round's guard sees, as before.
- **Its importers keep `sentIds`.**
  - event-update and the I/O import share `buildImportCypher` (`eventSync.js:198-323`; `io.js:449`), and the brain-write hook uses `importEventDirect` (`src/api/normalize/helpers.js:65-122`).
  - Each `MERGE`s by `uuid` and sets named properties, so importing a newer letter leaves the list on the node.
  - `graph delete-node`'s entry keeps every property (`delete-node.js:32, 289`).

### The ledger rows (the brief's item 4)

- **`2026-11-21-guard-test-checked-against-wrong-shape`** (meta).
  - **Well formed:** the id is the filename, 49 characters and six words, with `Type`, an ISO `Opened` and `Status: OPEN`. L15 passes it.
  - **True.**
    - Decision 11 promised that "a third publisher built the same way elsewhere is caught" (ADR 0034:228).
    - The sender the ADR prescribed takes its relay from `_relay.js`'s `open()` (ADR 0034:165, 273).
    - Round 1's blocking finding 1 and its harness note are as the row tells them.
    - `3-test-design.md` has the pitfalls section the row names (:29).
  - It records round 1's harness item, which round 2 found still unrecorded.
  - That the stand-in named `AbstractRelay` rests on round 1's record. The stand-in itself isn't on disk.
- **`2026-11-21-server-publishers-re1-cannot-see`** (docs).
  - **Well formed:** 43 characters, five words. L15 passes it.
  - **True of what it names,** and of ADR 0004's line 4, which still says "for every other module". "Since 2025-04" is when the NIP-85 scripts moved into `src/algos/nip85/` (`80b91954`).
  - **But it undercounts:** "already false twice", "Two senders" and "either exception". Its first fix shape, widening RE1's scan to `src/algos/`, wouldn't reach the third (finding 19).

### Docs (the brief's item 5)

| Claim | Checked against | Holds |
|---|---|---|
| BIBLE §6 (:377): `sentIds`, the newest 20, each once, the latest recorded last; accepted (set, already held, raced) and `unread`; a re-send adds none | `_record.js:109-116` | yes, "newest" as deviation 3 reads it (finding 20) |
| §6 (:378): the lock before the read; set while the id is the one read, or an older letter `sentIds` lists; the same letter's relays added as a re-send's; `raced` otherwise | `_record.js:83-108` | yes |
| §6 (:379): the entry holds each letter accepted or `unread`, an unread one on its node only in `sentIds`; `was` the same as `now` when the node already held it; delete-node keeps `sentIds` | `nostr.js:357-372`; `_record.js:97, 117-121`; `delete-node.js:289` | yes |
| §6 (:381): the importers turn away a letter the node holds, an older one, or one its `sentIds` lists; the guard reads only the node, so its cost doesn't grow with the history | `_own.js:43-54`; `tapestry-node-index.js:15` | yes. "Never comes back" is bounded at 20 (finding 20) |
| The catalog's row (:181) and "What an export does" (:186): `sentIds` beside `sentTo`, the newest 20, which today's importers turn away | the same | yes, as above |
| `changes.js:50-55`, and CHANGE's `was` (:93): an unread letter on its node only in `sentIds`; `was` the same as `now` for one the node already held | `_record.js:97, 118` | yes |
| CHANGE's `raced` (:90), unchanged: the node held a newer letter another export sent, or one no export sent | `_record.js:90-108` | yes, now that the tie isn't `raced`. Round 2's note of a node deleted meanwhile still applies |
| The declaration's description (`nostr.js:108`), its header (:17), the record's comment (:354-356) and the report's `address` (:92) | `_record.js`; `_scope.js:275-279` | yes |
| `_scope.js:10-13`: `graph-not-followed` naming its key, address and name | `_scope.js:275-279` | yes: the address and name when the graph has them |
| `_own.js:10-17`, and `TURNED_AWAY` (:58, unchanged) | `_own.js:43-54` | yes |
| The three importers' comments | `_own.js` | yes |
| `openapi.yaml:3622-3627` (unchanged): a letter "`export nostr` sent for it" is turned away | `_own.js` | yes, within the 20 |
| ADR 0004 (:5) | RE1; `profilePublish.js`; `src/algos/nip85/`; `bin/` | what it names, yes; complete, no (finding 19) |

### Nothing beyond the fixes (the brief's item 6)

- **`7bbf7d6c`** adds Amendment 3 (+10 lines) and the meta row. `src/` and `test/` are as at `adca099f`.
- **`8a445856`** changes only tests, their helper and the test plan.
  - The helper's change is additive: `withSentIds` and `sentIdsOf`, exported.
  - The plan's one changed line is its ADR line, extended.
- **`454e6c5e`** changes the 13 files the findings and their docs name, and no test. `_letters.js`, `_send.js`, `_relay.js` and `openapi.yaml` are as round 2 left them.
- **`ee7a5245`** adds the Evidence's three lines.
- No added line holds a run of 64 hex characters, `nsec1`, console output or a TODO.

### Findings (round 3)

#### Blocking

None.

#### Non-blocking

19. **`engineering-team/decisions/community-reference/0004-publish-export-a-concept.md:5`, `ledger/2026-11-21-server-publishers-re1-cannot-see.md:1, 11-13, 18` — a third server-side publisher RE1 can't see is left out.**
    - **The sender.** `bin/brainstorm-create-and-publish-kind10040.js` sends a kind 10040 letter from the server over `ws` (`:215`). It goes to the instance's relay, to the three `BRAINSTORM_NIP85_RELAYS`, and by default to three general relays, damus, primal and nostr.band (`:23-33`).
    - **Who runs it.** Two routes spawn it: `POST /api/create-and-publish-kind10040` and `POST /api/publish-signed-kind10040` (`src/api/index.js:181, 183`; `src/api/export/nip85/commands/create-and-publish-kind10040.js:42`, `publish-signed-kind10040.js:107`). Pages under `public/pages/` call the second, `customers/sign-up.html` among them. It has run this way since 2025-08 (`c08c96ae`).
    - **Why RE1 misses it.** RE1 doesn't read `bin/`, and can't see a script that a route spawns.
    - **What that leaves untrue.** Line 5 lists where the posture doesn't hold. The row says "already false twice", "Two senders" and "either exception". Each named claim is true, but neither list is complete. Deviation 8's reason for naming the NIP-85 publishers, that without them the sentence would be wrong, applies to this one too.
    - **Optional:** name it on line 5 and in the row (three senders, not two), and let the row's fix shape reach `bin/`.
20. **`engineering-team/stories/graph-operations-first-slice/34-export-nostr.md:144, 233`, `BIBLE.md:377, 381` — AC6 still promises "any letter an export of the node sent", and the cap now bounds that at the 20 latest recorded for the node** (the brief's item 3; deviation 3).
    - **When it bites.** It takes 21 records of one node in a row whose read-back didn't answer, or that raced, with no newer letter set between. The oldest of them can then come back in two ways:
      - through the I/O import or the brain-write hook, if someone posts it;
      - through event-update, if no later letter reached strfry.
    - **The docs.** BIBLE's "never comes back" and AC6's "any" are unqualified. "The newest 20" in BIBLE.md:377, `nostr.js:108` and the catalog's :181 means deviation 3's "latest recorded".
    - **For the owner, when Amendment 3 is ratified.** Either a line under the story's "Changed at Review" that names the bound, or "the 20 latest recorded" in those sentences.
21. **`engineering-team/stories/graph-operations-first-slice/34-export-nostr.md:357` — nothing on record shows that the live re-check ran the fixed code.**
    - **What the log shows.** `tmp/live-check-34/nostr-live.log` ran at 05:23:13–05:24:11Z, after `454e6c5e` was committed (05:22:54Z). It ran on a container whose mounts its runner checked, and they include the worktree's `src/`.
    - **What it doesn't show.** The control panel must restart to load new code, and no record holds that restart. Round 2 had one: `r2-setup.log`, with the files' hashes and the restart time.
    - **Why it matters little.** LV1 to LV6 read no `sentIds`. The run's worth is that the new statements run on a real Neo4j, and that rests on the Evidence's word.
    - **Optional:** record the restart time, and the export files' hashes inside the stack, in `tmp/live-check-34/`.

### Harness friction

1. **Round 2's second item is still unrecorded.** Finding 16's substring matcher was another case of OPEN.md rows 116 and 174, and this diff touches neither row. That remains the owner's call.

### On PASS

- The story already reads `**Status:** Done` (story:3), and this round changes nothing else in it.
- Completion detection was performed again. Its result is in the chat, not in this file.
- Nothing is committed: the brief asks for no commit, push or GitHub call.

### Verdict (round 3)

**PASS**
- **Each round-2 finding is resolved** as Amendment 3 says, and the two doc findings, 17 and 18, as their wording asks. Each fix a test reads is red on round 2's code and green on HEAD's, on Node 24 and on Node 22.
- **The guard reads only the node**, and no change entry is read on its path. A node's `sentIds` holds only the ids of letters export signed, so the guard can't be made to turn away a letter no export sent.
- **The eight deviations are accepted.** Deviations 3 and 5 got a hard look, and neither changes a guard answer within the 20.
- **Three non-blocking findings are new:**
  - 19: a third server-side publisher, left out of ADR 0004's line and the ledger row;
  - 20: AC6's "any" against the cap of 20, for the owner when Amendment 3 is ratified;
  - 21: no record that the live re-check ran the fixed code.
- **For the owner to ratify:** Amendment 3, at the next gate, with finding 20's bound.
