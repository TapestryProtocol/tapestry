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
