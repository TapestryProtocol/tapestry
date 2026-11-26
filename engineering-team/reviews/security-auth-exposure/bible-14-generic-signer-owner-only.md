# Review: doc lane — BIBLE §14 Assistant Keys, who the generic signer signs for

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-26
**Diff:** `git diff` (uncommitted, unstaged) on `docs/bible-14-generic-signer-owner-only`, in the worktree `tapestry-worktrees/docs-bible-14-generic-signer`, over `d8b94c102` (`staging`, the merge of PR #212). One file, `BIBLE.md` (+2 −2): line 8 (`**Last updated:**`) and line 1274, the last sentences of the identification-tagging paragraph in §14 Configuration › Assistant Keys (`:1256`).
**Lane:** doc lane (`engineering-team/workflows/0-intake.md` step 3: Doc / one-liner, Implementer then Reviewer). A non-numbered review with no story, no test plan and no book; this file is the lane's record. Template: the docs-mode / doc-lane variant of `templates/review-checklist.md` (`:20`).
**Spec:** the brief's six claims about the changed text, each checked against the code and the records, not against the brief.
**Filed under:** security-auth-exposure. The rule the new sentence states was made in that epic's story 8 (ADR 0005), and the new `Last updated` entry already names this file's path.

## Quality gates (run by reviewer, not trusted)

- [x] `git diff --check`: no output, exit 0. `git diff --stat`: 1 file, 2 insertions, 2 deletions; hunks `@@ -8 +8 @@` and `@@ -1274 +1274 @@` only.
- [x] `bash scripts/harness-lint.sh` in the worktree, before this file was written: last line `harness-lint: clean (0 violations)`, exit 0. With this file in place: the same last line, exit 0. Its one line about this file is `INFO non-numbered-review`, whose "predates the numbering convention" mislabels a doc-lane review; that is the open row `ledger/2026-11-16-lint-mislabels-doc-lane-reviews.md`, so no new row. The shared verdict rule (`scripts/lib/review-verdict.awk`) reads this file as PASS.
- [x] **Every suite that reads BIBLE.md, run directly.** `grep -rl -F "BIBLE.md" test --include='*.test.js'` lists 32 files. A wider `grep -rl BIBLE test` adds 18 files that cite BIBLE only in comments or messages; the one regex hit, `test/event-less-create-set.test.js:685`, tests `nodes.js`'s header, not BIBLE. Each of the 32 was run with `perl -e 'alarm 120; exec @ARGV' node <file>` from the worktree root, one log per suite named by its full path (so the two `nostr.test.js` files don't share one):
  - 30 exited 0 and 2 exited 1: `test/operations/export/nostr.test.js` (14 passed, 1 failed, 0 skipped) and `test/router-stream-limit-on-connect.test.js` (23 passed, 3 failed, 0 skipped).
  - **13 of the 30 that exited 0 ran nothing.** They export `run()` with no `require.main === module` guard, so `node <file>` loads them and exits 0 within a second with no output (friction 1): `assistant-attention`, `assistant-duties-settings`, `assistant-duty-menu-check`, `assistant-duty-menu-publish`, `assistant-management-page`, `assistant-outbox-check`, `assistant-relay-list-publish`, `assistant-self-map-check`, `brains-launcher-repo`, `harness-lint`, `scheduled-search-and-house-scores-refresh`, `task-queue-semaphore-protection-audit`, `treasure-maps-router-preset`. The other 19 printed their own summaries: 656 passed, 4 failed, 19 skipped.
- [x] **The same 32 through the gate engine, so that the 13 actually run.** A driver in the session scratchpad calls the worktree's own `runGate({ suites, label })` (`test/helpers/gateRunner.js`) with one `{ file }` entry per suite, in the environment `test/test.js` sets. `npm run gate:status -- --label review-bible-14-generic-signer`:
  `20261126T174350Z-15588-0ee5 [review-bible-14-generic-signer] started 2026-11-26T17:43:50.676Z on d8b94c10+dirty — FAIL, exit 1, 1148 passed, 4 failed, 22 skipped, 32/32 suites; failed: operations/export/nostr, router-stream-limit-on-connect`
  - The record: 30 suites PASS and 2 FAIL. The four failed checks are the four of the direct runs. All 13 export-only suites PASS.
  - The 22 skips are live or network checks: a live `H1` probe in each of `assistant-attention`, `assistant-management-page` and `assistant-relay-list-publish`; `graph-rule-firmware` GL1–GL4 (`TAPESTRY_CONTAINER` not set); and `llms-txt`'s 15 (live H1–H3 and remote link checks, one of them main's BIBLE.md on GitHub). None reads the local BIBLE.md content the diff changes.
- [x] **The two failures, without the change.** The main checkout `/Users/clawds4/repos/nous-clawds4/tapestry` (clean, at `d8b94c102`; used read-only, and `git status --short` still empty afterwards), the same two files:
  - `node <file>`: `operations/export/nostr` 14 passed, 1 failed (EN2); `router-stream-limit-on-connect` 23 passed, 3 failed (P1–P3). The same tests, with the same messages.
  - **EN2:** `export nostr failed: Cannot find package 'micromark' imported from …/src/lib/markdownLinks.js`, in both trees. `package.json:79` declares `"micromark": "4.0.2"` (added 2026-11-20, `26712dede`), and the shared host `node_modules` has no `micromark` (its `.package-lock.json` dates from Sep 20). Environmental (friction 3).
  - **P1–P3:** `sed: 1: "…": invalid command code f`, in both trees: the patch script's GNU `sed -i` under macOS's BSD sed. Already tracked: `ledger/2026-10-09-router-patch-sed-macos.md` (OPEN), which warns that these "read as a regression in each reviewer's comparison".
  - Through main's own engine, with the record kept out of the main tree (`GATE_RECORD_DIR` in the scratchpad): `20261126T174528Z-60043-1163 [review-bible-14-baseline-main] started 2026-11-26T17:45:28.290Z on d8b94c10 — FAIL, exit 1, 37 passed, 6 failed, 0 skipped, 2/2 suites; failed: operations/export/nostr, router-stream-limit-on-connect`. The two extra failed checks are one per suite from the engine's hermeticity rule ("left process.env changed after its run (2 keys): added NEO4J_PASSWORD, OWNER_PUBKEY"). They come from the main checkout's local `.env`, not from the code (friction 2).
- [x] **The behaviour behind the new sentence**, through the engine: `test/admin-action-sweep-access.test.js`, whose PARAM1 (`:352-364`) is the admin-403 check. `npm run gate:status -- --label review-bible-14-param1`:
  `20261126T174725Z-60382-8cd3 [review-bible-14-param1] started 2026-11-26T17:47:25.157Z on d8b94c10+dirty — PASS, exit 0, 13 passed, 0 failed, 0 skipped, 1/1 suites`
- [ ] `npm test`, the full gate: **not run, on purpose.** On this Mac about 40 suites reach the agent-memory instance (`ledger/2026-11-21-scoped-gate-lists-built-by-hand.md`). A diff to BIBLE.md alone can change the outcome only of suites that read BIBLE.md, and all 32 ran above. In docs-mode `npm test` is a regression check only.
- [ ] Playwright: not applicable (no UI change).
- [ ] _Lint / typecheck / build not configured: skipped._
- [ ] Independent checker (`workflows/5-review.md`, "Optional: an independent check before the commit"): not applied; this agent can't start one. The session that commits this review can run one first.

## Claims adherence (doc-lane variant)

| # | Claim (where) | Source checked | Holds? |
|---|---|---|---|
| 1 | The generic signer is `POST /api/strfry/publish` with `signAs: "assistant"` (`:1274`) | `src/api/index.js:270` registers the route to `strfry.handlePublishEvent`. `src/api/strfry/commands/publishEvent.js:3-7` (header) and `:56` (the assistant branch). `signAs: "client"`, or none, only publishes an event its author already signed (`:82-100`) | Yes |
| 2 | It signs only as the TA (`:1274`; "as the TA", `:8`) | `publishEvent.js:65` reads `getOwnerAssistantKeys()`, which reads only `tapestry-assistant` (`src/utils/assistantKeys.js:32-35`), the TA's slot (BIBLE `:1260`). The template (`:73-78`) takes kind, `created_at`, tags and content, and `finalizeEvent` (`:80`) sets the pubkey from the TA key, so a request's own `pubkey` is never used | Yes |
| 3 | Only for the owner or a direct local call (`:1274`, `:8`) | `publishEvent.js:61`: `if (!isOwner(req) && !req.localTrusted)`, then 403 (`:62`). The handler's `isOwner` (`:33-36`) is a completed sign-in whose pubkey is `getOwnerPubkey()` (`src/utils/config.js:96-97`, `BRAINSTORM_OWNER_PUBKEY`). `req.localTrusted` is set only at `src/middleware/auth.js:369`, for a loopback peer with no `X-Forwarded-For` or `X-Real-IP` header (`:365-367`) | Yes |
| 4 | An admin is refused 403 (`:1274`, `:8`) | An admin's session pubkey is not the owner's, so `:61-62` answer 403 "Only the owner can sign as the assistant." The route table opens the route to `public` (`src/middleware/routeAccess.js:427-429`), so the refusal is the handler's. PARAM1 asserts it: an admin gets 403 with no key read and no import, and the owner and a direct-local caller are allowed (`test/admin-action-sweep-access.test.js:209-211`, `:352-364`); run `20261126T174725Z-60382-8cd3`, PASS. (A kind 0 is refused 403 `one-writer` for everyone before this gate, `:50-52`, as BIBLE `:1272` already says) | Yes |
| 5 | The source: security-auth-exposure ADR 0005, owner's decision 3 (`:1274`, `:8`) | ADR 0005 `:183` "The owner's decisions at the gate (2026-10-10)", item 3 (`:189-192`): signing as the instance's assistant through the client-publish route (`signAs:'assistant'`; "settles OPEN.md row 269") becomes owner-only, checked in its handler against the owner pubkey. `:10-12`: the later graph-operations-foundation/0002 amendment leaves "item 3 of the owner's decisions" standing on its own routes. "Owner's decision 3" is the right citation; the ADR's own Decision 3 (`:161-162`) is a different item (N4) | Yes |
| 6 | OPEN.md row 269, done 2026-10-11 (`:1274`, `:8`) | OPEN.md `:301`: status `DONE`, resolution "2026-10-11 — the owner decided owner-only (story security-auth-exposure #8, ADR 0005): an admin is refused 403 on `signAs:'assistant'`; the owner and direct-local callers keep it." | Yes |
| 7 | "as it has since 2026-10-11" (`:8`) | `151e39fb` (staging) was committed 2026-10-11 00:09 UTC, and PR #847 merged 2026-10-11 00:15 UTC (`175cffa64`, 17:15 −0700 on 2026-10-10). Both fix commits (`151e39fb`, `0493377a2`) are on `origin/staging` and `origin/main`, and in the base. 2026-10-11 is the UTC day, and row 269's | Yes |
| 8 | "by the handler's own owner check rather than the auth middleware's owner-or-admin `isOwner()` alias" (`:1274`) | `publishEvent.js:30-36` defines its own `isOwner`, with a comment saying it is deliberately not the alias; its requires (`:9-13`) take nothing from `middleware/auth`. The alias is `src/middleware/auth.js:288-294` (`isOwner` returns `isOwnerOrAdmin`, `:277-285`), as BIBLE `:1264` says | Yes |
| 9 | The replaced sentence ("The generic signer stays owner-or-admin (OPEN.md row 269) and TA-only, …") was out of date | It was written 2026-09-22 (`f58591c27`), when the handler imported the alias (`f58591c27:src/api/strfry/commands/publishEvent.js:11`, gate `:53`), so it was true then. It has been untrue since 2026-10-11 (claims 4, 7, 8) | Yes |
| 10 | "The other assistant-key signers — trusted lists, curated DList headers and updates, normalization, NIP-85 — are unchanged." (`:1274`) | Carried over word for word, apart from the new sentence break. ADR 0005's owner's decision 3 made only two parameter-level rules owner-only, this one and the admin list, and kept "every other flagged action" at `owner` (`:189-192`); the actions that sign as the instance were among the flagged (`:172-175`). `docs/GRAPH_OPERATIONS_CATALOG.md:255` says the signing normalize routes still let admins sign. Not re-derived signer by signer | Yes, as carried-over text |
| 11 | The new `Last updated` entry follows the line's format and keeps every earlier entry | A script compared line 8 at `HEAD` with the worktree's: the new line is the new head, then `; prior: 2026-11-21 — `, then the old line's body after `**Last updated:** 2026-11-21 (content: `, byte for byte (12,938 characters each). The `; prior:` count goes from 33 to 34, the parentheses balance across the line, and the head's backticks pair. The newest date (2026-11-26) is first, and the old head becomes `prior: 2026-11-21 — §7 + §22 — …`, the form the other entries use | Yes |
| 12 | The entry names this review (`security-auth-exposure/bible-14-generic-signer-owner-only`) | This file's path | Yes |

### Cross-document consistency

| Where | What it says about who may use the generic signer | Consistent? |
|---|---|---|
| BIBLE §11 `:587` (the `/api/strfry/publish` row) | Only the kind-0 refusal; nothing on who may sign | Silent, not wrong (N2) |
| BIBLE `:1264` | The middleware's `isOwner()` is an alias of `isOwnerOrAdmin()` | Yes; the new text relies on it |
| BIBLE `:1272` | `/api/strfry/publish` refuses an assistant kind 0 | Yes |
| BIBLE §16 `:1632` | The brain-first hook in `/api/strfry/publish`; client-signed publishing stays permissionless | Yes |
| BIBLE §31 `:2090` | Identity attaches to the instance, not to the key custodian | No conflict: custody, not route access |
| `src/api/openapi.yaml:3799-3801`, `:3814` | `signAs "assistant"` "is the owner's alone, or a direct-local caller's: 403 for anyone else, admins included" | Yes |
| `src/middleware/routeAccess.js:427-429` | The handler "keeps signAs:'assistant' for the owner (ADR 0002, ADR 0005)" | Yes |
| `docs/GRAPH_OPERATIONS_CATALOG.md:255` | "`/api/strfry/publish` with `signAs: assistant` is owner only (ADR 0005)" | Yes |
| AGENTS.md, OPERATIONS.md | No hit for `strfry/publish`, `signAs`, `generic signer`, `row 269` or `as the TA`. OPERATIONS.md `:1206` (an admin may download a backup, which holds the assistant's key) is another route, which ADR 0005 `:10-12` already reconciles with item 3 | No conflict |
| `test/one-writer-assistant-profile.test.js:214`, `:218`, `:478-479` | An admin "passes the generic signer's owner gate (isOwner is owner-or-admin)" | No: stale since 2026-10-11 (N1), outside the diff |

Searched in BIBLE.md: `strfry/publish`, `signAs`, `generic signer` and `row 269` (hits at `:8`, `:587`, `:1272`, `:1274`, `:1632`); signing "as the TA / instance / assistant", `mint`, `TA-signed`; and owner-or-admin wording near signing. No other passage says who may use the generic signer.

## ADR adherence

Not applicable as such: the lane has no ADR. ADR 0005 is a source (claims 5 and 10). The diff adds no code, no dependency and no layering.

## Concept-graph integrity

- [x] No concept definition or handle is touched, so no firmware reinstall is needed.
- [x] No new code, so nothing has to orient via `/summaries`.

## Things tests can't catch

- [x] No secrets, debug output or commented-out content in the diff. The `.env` in friction 2 was checked by key name only; no value was read.
- [x] Scope: the two lines. The rest of the paragraph is unchanged (`git diff -U0`).
- [x] No TA pubkey literal is added.
- [x] Security reading: the text widens and narrows nothing; it reports the gate the code already has. Its route, parameter, who passes and the refusal are what `src/api/openapi.yaml` already states, so it discloses nothing new.

## House rules check

- [x] Concept Graph API authority: no concept claim is made.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence

Not applicable: no PRD-traced copy.

## Findings

### Blocking

None.

### Non-blocking

1. **N1. `test/one-writer-assistant-profile.test.js:214`, `:218` and `:478-479` still say an admin passes the generic signer's owner gate.** `:218` labels a caller "an Admin (the owner gate is owner-or-admin)", and `:478-479` say "An Admin passes the generic signer's owner gate (isOwner is owner-or-admin), so only the kind-0 refusal stands between them and the TA's profile." Since 2026-10-11 the owner gate refuses the admin too (claims 4 and 8). The assertions still hold, because the kind-0 refusal comes before the owner gate (`publishEvent.js:50`, then `:61`), so the suite passes; only the comments are stale (last changed 2026-10-09, `ef81af670`). Outside this doc lane. **Optional:** correct the three comments in a later change, or record a ledger row.
2. **N2. BIBLE §11's `/api/strfry/publish` row (`BIBLE.md:587`) says nothing about who may sign as the assistant.** It isn't wrong, and §14 now says it; `src/api/openapi.yaml:3800` states the rule too. **Optional:** add "the owner or a direct-local caller only; an admin is refused 403 (§14 Assistant Keys)" to the row.
3. **N3. The publish entry in `src/api/openapi.yaml` doesn't match the handler's shapes.** Its request schema lists only `event` (`:3808-3809`), not `signAs`, and its 200 response lists `eventId` (`:3824`), while the handler answers `{ success, event, brainWrite? }` (`publishEvent.js:134`). Unrelated to who may sign, and outside the diff. **Optional:** a ledger row.
4. **N4. ADR 0005's own Decision 3 (`:161-162`) says the handler keeps `signAs:'assistant'` "for the owner's side", and `:125-126` define the `owner` level as owner, admins and direct-local.** The owner's decision 3 at the gate (`:189-192`) narrows it to the owner, and the code follows the gate. BIBLE cites "owner's decision 3", the right item. No change asked, since an ADR is a record; noted so that no later citation says "Decision 3".

### Harness friction *(each becomes a ledger row, type `meta`, if the session agrees)*

1. **Running a suite with `node <file>` can run nothing and still exit 0.** 13 of the 32 suites that read BIBLE.md export `run()` with no `require.main === module` guard (listed under Quality gates). Under `node <file>` they exit 0 with no output, so a scoped gate read from exit codes counts 13 passes that never ran. Only the gate engine runs them, and it has no switch for a chosen list of suites (its switches are `GATE_JOBS`, `GATE_PART`, `GATE_LABEL` and `GATE_RECORD_DIR`), so this review drove `runGate` from a scratchpad script. Neighbours: `ledger/2026-11-22-scoped-gate-recipe-lives-in-tmp.md` (the recipe is untracked) and `ledger/2026-11-21-scoped-gate-lists-built-by-hand.md`. Fix shape: a tracked scoped-gate entry that takes a suite list and runs it through the engine, with "never `node <file>`" in the scoped-gate guidance; or a guard in every suite.
2. **A gate run from the main checkout fails each suite that loads `lib/config.js` during its run, because of that checkout's own `.env`.** `lib/config.js:23` calls `require('dotenv').config()`, which reads `.env` from the working directory. The main checkout has a gitignored `.env` that defines `OWNER_PUBKEY` and `NEO4J_PASSWORD`, and requiring `lib/config.js` there adds exactly those two keys to `process.env` (a probe that printed key names only; run from the worktree, it adds none). The engine's hermeticity rule (ADR `test-suite-hermeticity/0002`) then counts one more failed check per suite, as in the baseline above, so a reviewer's main-checkout comparison shows failures a worktree doesn't have. No row found for it in OPEN.md or `ledger/` (searched for `dotenv`, `lib/config.js` and `.env`).
3. **The shared host `node_modules` lacks `micromark`** (`package.json:79`, added 2026-11-20), so `operations/export/nostr` EN2 fails in both trees. This is an instance of OPEN.md row 280's cause (the host checkout needs its own `npm ci`); no new row is needed unless the session wants one.

## Verdict

Every claim the two changed lines make holds against the code and the records. The generic signer signs only with the TA key, only for the owner's own sign-in or a direct local call, and refuses an admin 403 by its own owner check, as ADR 0005's owner's decision 3 ruled and as OPEN.md row 269 records, done on 2026-10-11. The sentence it replaces was true when written and has been stale since. The `Last updated` entry keeps every earlier entry byte for byte. Harness lint is clean, and the only failing BIBLE-reading suites fail the same way without the change. The one contradiction found (N1) is in a test's comments, outside the diff.

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**`: not applicable. A doc-lane review has no story file (0-intake step 3).
- [x] Completion detection: no book (a doc / one-liner opens none, 0-intake step 4). Reported in the hand-off, not here.
- [ ] Commit: left to the session, as the brief asks. A suggested message: `review: bible-14-generic-signer-owner-only — PASS (security-auth-exposure, doc lane)`. The commit takes `BIBLE.md` and this file.
