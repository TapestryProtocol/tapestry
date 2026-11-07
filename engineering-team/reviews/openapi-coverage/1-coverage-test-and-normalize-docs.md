# Review: Story 1 — The API docs say what they cover: a coverage test, the normalize routes, and Try it out on this instance

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-06
**Diff:** `git diff 7a57b49bf..cb356a52b` (story `4e147f890`, tests `8198c8ad4`, implementation `cb356a52b`), branch
`feat/openapi-coverage`
**Story:** `engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.md` (Bug; no ADR, Architecture
skipped at the planning gate)
**Test plan:** `engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` (the full gate): not run. On this Mac the full gate publishes test fixtures to public relays (the
      owner's standing rule), so it is left to CI on the PR. `npm run gate:status` in this worktree answers
      `no gate run records in …/openapi-coverage/tmp/gate-runs`: there is no gate run here to quote. CI's run on the
      PR is the gate record for this diff.
- [x] The two new suites, through the stub runner (dead ports, a `docker` that refuses, a nonexistent container),
      both ways the gate can load them:
  - `node test/openapi-coverage.test.js`: **12 passed, 0 failed, 0 skipped**, exit 0 (D2's throwaway-copy demo ran,
    not skipped). Run again on the final tree: the same.
  - `node test/openapi-document.test.js`: **10 passed, 0 failed, 0 skipped**, exit 0.
  - Through each suite's exported `run()` (how `test/helpers/gateRunner.js` loads them): `pass=12 fail=0 skipped=0`
    and `pass=10 fail=0 skipped=0`.
  - Neither suite, nor `test/helpers/routeWalk.js` or `test/helpers/openapiNormalizeRoutes.js`, matches the screen
    `docker exec|dockerCurl|execFileSync('docker'|TAPESTRY_PORT|TAPESTRY_CONTAINER|strfry/publish|\bnak\b`. Both
    clean up their temp dirs (none left under the OS temp dir after the runs).
- [x] Regression: the 32 suites that read `src/api/openapi.yaml` or `BIBLE.md` (grep of `test/*.test.js` for
      `openapi|BIBLE`), less `test/adoption-twins.test.js`, all through the stub runner's `run()` path:
      **1319 passed, 3 failed, 24 skipped**. 31 suites have 0 failures. The 3 failures are
      `test/router-stream-limit-on-connect.test.js` P1–P3, `sed: … invalid command code f`: the router patch's GNU
      `sed -i` (`patches/strfry-router/apply-patches.sh:25`) under macOS's BSD sed. Not this diff (it touches no shell,
      setup or patch file), and already on file as `ledger/2026-10-09-router-patch-sed-macos.md` (OPEN).
  - `test/harness-lint.test.js` and `test/event-less-create-set.test.js` match the screen and were run only through
    the stub runner. harness-lint's matches are string fixtures (85 passed). event-less-create-set's live matrix
    skipped because its container doesn't exist (14 passed, 11 skipped, as intended).
  - Left out: `test/adoption-twins.test.js` (excluded by instruction) and `test/stack-free-npm-test.test.js` (its G2
    runs a live suite against whatever answers on :7778).
- [x] Browser spec `tests/brainstorm/openapi-docs.spec.js`, re-run by the Reviewer on a scratch stack booted from this
      worktree, following the test plan's § How to run exactly (`scripts/scratch-stack.sh up`, the loopback-only
      forward from `tapestry-tapestry`, `OPENAPI_DOCS_SCRATCH=1 BRAINSTORM_BASE_URL=http://127.0.0.1:18080`):
      **3 passed (7.1s)**, none skipped. The served `/docs/swagger-ui-init.js` carries `"url": "/"`. The scratch
      instance's nginx log holds the request P3 sent, with `/docs` as referer:
      `"GET /api/normalize/node-primitives HTTP/1.1" 200 72 "http://127.0.0.1:18080/docs/" "… Chrome/141.0.7390.37 …"`.
      Torn down afterwards (`docker rm -f tapestry-scratch-fwd`, then `scripts/scratch-stack.sh down`); no scratch
      container or network is left.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story (the two additions beyond AC4 are in the story's ## Deviations;
      see below).

| AC | Evidence | Verdict |
|---|---|---|
| AC1 runs on its own, exits non-zero on a failure, stack-free, in the registry | R1 (spawns the suite, compares exit with the summary); D2 (exit non-zero in the copy); both suites in `test/registry.js:379-382`; my runs above with dead ports and no container | met |
| AC1 counts the walk + the entrypoint's own `/api/` routes, once each | W1, E1; my own walk: 388 registrations under `/api/`, 387 distinct (`POST /api/firmware/install` twice), methods GET/POST/PUT/DELETE only | met |
| AC1 `:param` / `{param}` / `*` one segment; quoted keys | M1, M2 (`'/api/settings/{keyPath}'` documents `DELETE /api/settings/*`) | met |
| AC2 (a)–(d), naming `METHOD /path` | C2–C5 and D1; D2 shows (a) with a route added to `src/api/index.js` and (b) with a documented route's line on the list, in a throwaway copy | met |
| AC3 the 20 entries, body / answers / who may call it | N1–N4, plus the hand audit below (every entry checked against its handler and core) | met |
| AC3 agrees with BIBLE §11's 5 rows | N5; by hand against `BIBLE.md:474-478`: every status, enum and named field in the rows is in the entries | met |
| AC3 gap list 196, none under `/api/normalize` | C6 + C2/C3/C5; my independent check below | met |
| AC4 `servers: [{url: /}]`, the description line, the contact URL | S1–S3; `src/api/openapi.yaml:15-27` | met |
| AC4 scratch stack: loads, shows the 20, Try it out reaches the scratch instance | browser spec 3/3 and the nginx log line above | met |
| AC5 BIBLE §11's paragraph | B1; `BIBLE.md:604` | met |

### The gap list (`test/fixtures/openapi-known-gaps.json`)

Checked independently of the suite's own matching rule (my own walk in a child process, my own normalisation):
registered 387, documented 191 (all under `/api/`), registered minus documented = **196**, and the list is exactly that
set: nothing listed that is documented or unregistered, nothing undocumented that is unlisted, no line twice, every
line spelled as the route is registered (Express form), 0 lines under `/api/normalize`. The list is sorted by path,
then method. The 13 computed-path routes the issue's text search missed are on it, and the commented-out
`POST /api/publish` is not registered and not on it. `GAP_CEILING` is 196 (`test/openapi-coverage.test.js:54`), equal
to the list's length.

### The 166 path entries that were already there

Compared as parsed YAML (js-yaml, the reader the server uses), `8198c8ad4` against `cb356a52b`, not the textual diff:
all 166 old path keys are present, `util.isDeepStrictEqual` on every one, in the same key order. The 20 added keys
are all `/api/normalize/*` (166 → 186 keys, 171 → 191 operations). `tags` and the two existing component schemas
(`SuccessResponse`, `ErrorResponse`) are unchanged. What changed outside `paths` is exactly `info.description`,
`info.contact`, `servers`, and the 10 added components the Deviations name. The test commit did not touch the YAML.
Every `$ref` the new entries use resolves.

### Accuracy audit of the 20 entries (the plan's § Edge cases, by hand)

For each: required/optional body fields and types against what the handler reads and checks, every status the
handler or its helpers send, every named refusal in the handler and its core (including ones reached through
`src/lib/brain/*`), the success answer's shape, enums, and who may call it (`src/middleware/routeAccess.js:293-332`
plus each handler's `isOwner(req) || req.localTrusted` check; `isOwner` is `isOwnerOrAdmin`,
`src/middleware/auth.js:292-294`, so "owner, admin or direct-local" is right for every POST). The 401 and 403 answers
come from `authMiddleware` (`src/middleware/auth.js:403-405`) for every owner action, and the handler's 403 adds
nothing new. No normalize route is on the customer-or-owner list (`auth.js:327`).

| Route | Handler (and core) | Verdict | Notes |
|---|---|---|---|
| POST `reconcile-primary-property` | `index.js:2112` (`reconcilePrimaryPropertyForConcept`, `:2032`) | accurate | Refusals use `code`, not `refusal`, and the entry says so; the 5 codes match `:2047-2073`; `result` enum, `properties.before/after` and `note` match `:2081-2109`. |
| POST `create-child-goal` | `index.js:2195` (`createChildGoal` `:2236`, `validateDecompositionOp` `goals.js:219`) | accurate | Required parent/name/statement are the three 400s; the refusals `parent-not-found`, `ambiguous-slug`, `name-collides` are the only ones the create-child path can return; intent fields via `pickIntentFields` (`goals.js:302`); `chanceOfSuccess` 0–100 matches the concept's own schema (`index.js:4900`). See non-blocking 1. |
| POST `update-goal-intent` | `index.js:2296` (`updateGoalIntent` `:2353`) | accurate | The 7 refusals are exactly the handler's `empty-value`, the core's `goal-not-found`/`ambiguous-slug`, and set-parent's `parent-not-found`, `self-parent`, `already-has-parent`, `cycle` (`goals.js:242-268`); the 400 "none of the settable fields" matches `:2320-2325`. |
| POST `create-resource` | `index.js:2529` (`createResource` `:2560`) | accurate | `locatorKind` enum is `RESOURCE_KINDS` (`:2414`). It is listed as required, but a missing one answers 200 `unknown-kind` rather than 400; the entry names that refusal, so the shape is right. |
| POST `verify-resource` | `index.js:2638` (`verifyResource` `:2666`) | accurate | `reachable` defaults true (`reachable !== false`); `freshness` enum matches `deriveFreshness` (`src/lib/brain/resources.js:80-85`). |
| POST `create-work-record` | `index.js:2838` (`createWorkRecord` `:2873`) | accurate | `produced` items are objects in create-resource's shape (`:2892-2905`), as documented; a create-resource refusal for a produced entry passes through, and the entry rightly does not claim "writes nothing" (earlier produced entries stay attached). `refusal` has no enum, which is right since create-resource's names can appear. |
| POST `note-goal-idea` | `index.js:2920` (`noteGoalIdea` `:2953`) | accurate | Only refusal `name-collides`; answer `goal` + `record` match `:3003-3008`. |
| POST `make-proposal` | `index.js:3166` (`makeProposal` `:3209`) | accurate | All 10 refusals are present, in handler then core order; "viable" = leaf with deliverable and boundary (`goals.js:82-86`); `maxItems: 8` = `MAX_PASSED_OVER`. |
| POST `approve-proposal` | `index.js:3274` (`decideProposal` `:3325`) | accurate | `ProposalDecision` matches `:3347`. See non-blocking 3. |
| POST `skip-proposal` | `index.js:3292` (`decideProposal`) | accurate | `reason-required` comes from the handler as 200 (`:3304-3309`), not 400, as documented. |
| POST `record-priority-signal` | `index.js:4788` (`recordPrioritySignal` `:4816`) | accurate | The non-string `reason` is a 400 (`:4801-4802`), covered by BadRequest; refusals `same-goal`, `goal-not-found`, `ambiguous-slug`. |
| POST `restore-brain` | `index.js:5009` (`restoreBrain` `:5034`) | accurate | Shape problems are 400 (`validateArtifact`); `goal-collides`/`record-collides` with `collisions`; `restored` counts per family match `:5105`. |
| POST `record-restore-drill` | `index.js:5200` (`recordRestoreDrill` `:5228`) | accurate | Three 400s (date, outcome enum, target type); default target text matches `DEFAULT_DRILL_TARGET`; no refusals. |
| POST `adoption-disposition` | `index.js:5307` | accurate | target not an a-tag is 400; an unknown disposition is 200 success false with only `error` (`:5318-5320`), as documented; create-element's status passes through (`:5339-5342`): its 200-with-success-false becomes 500, and its own 400s are not reachable here (concept and name are always sent), so 400/500 cover it. |
| POST `trusted-dictionary-snapshot` | `index.js:5416` (`assembleTrustedDictionary`, `src/api/adoption/index.js:204`) | accurate | Body optional (`req.body \|\| {}`), as documented. See non-blocking 2. |
| POST `add-relationship` | `relationships.js:150` (`gateAndValidate` `:101`, `respondMissingNodes` `:131`) | accurate | 400 body carries `allowed` only for an unknown relType (`:118-122`); 404 `missing` names exactly the absent uuids; `note` on `created` only; matches `BIBLE.md:474`. |
| POST `delete-relationship` | `relationships.js:188` | accurate | `deletedCount`, `deleted`/`not-found`, `note` on `deleted` only; matches `BIBLE.md:475`. |
| GET `relationship-primitives` | `probe.js:16` | accurate | Fixed body (`probe.js:10-14`); public read; no 401/403 documented. |
| POST `add-subset` | `nodes.js:109` | accurate | Every `fail()` status: 403, 400×3 (+ the parent-label 400), 404 with `missing`, 409, 500×4; `hasEvent` on already-existed only, `note` on created only; matches `BIBLE.md:477`. |
| GET `node-primitives` | `nodePrimitivesProbe.js:17` | accurate | Fixed body; public read; P3 got it through Try it out on the scratch stack. |

No entry says anything the handler contradicts. The non-blocking items below are omissions.

### The other AC items

- `servers` (`src/api/openapi.yaml:26-27`): one entry, `url: /`. Proven in a browser to resolve to the serving origin.
- `info.contact.url` (`:24`): the gitworkshop URL, exactly the story's.
- `info.description` (`:15-20`): the Try it out paragraph ("real requests to this instance … with your session if you
  are signed in. A write is a real write.") and the Coverage paragraph (a Deviation).
- BIBLE §11 "API Documentation" (`BIBLE.md:604`): no "all REST endpoints"; names `src/api/openapi.yaml`, the gap list,
  the suite, the dated count "196 on 2026-11-06, of 387 routes" (true; see above), what the suite fails on, and what
  Try it out does. "Publicly accessible (no auth required)" holds: `/docs` is mounted before `authMiddleware`
  (`bin/control-panel.js:318-323`).

### Deviations (story ## Deviations)

All five are justified and in scope. The shared components keep the 20 entries short without touching the 171 old
ones. The refusal-name enums are read from the handlers. The pass-through statuses for adoption-disposition and
snapshot are right (see the table). The Coverage paragraph and BIBLE's extra sentences are accurate.

## ADR adherence

- [x] No ADR (Bug, Architecture skipped and approved at the planning gate). The files changed match the story and test
      plan: the Implementer's commit touches only `src/api/openapi.yaml`, `test/fixtures/openapi-known-gaps.json`
      (assigned to the Implementer by the plan), `BIBLE.md` (one paragraph) and the story's Deviations. No test file
      was edited in Phase 4.
- [x] Layering: documentation and a test only; no runtime code changed.
- [x] No new dependencies (`package.json` untouched; `js-yaml` is already the server's reader of the document).

## Concept-graph integrity

- [x] No handles touched.
- [x] No concept definitions changed, so no firmware reinstall is needed.
- [x] N/A: no new runtime code that orients on concepts.

## Things tests can't catch

- [x] No secrets. The only new identifier is the public npub in the contact URL.
- [x] No debug logging; no commented-out code.
- [x] Error paths: the suite fails loudly when the walk fails (`registeredPairs` asserts on exit status and
      `registerError`), and a register(app) that silently drops a module would show as C4/C5 failures.
- [x] Concurrency: N/A. The walk runs in a child with temp settings, conf and base dir, the same walk the admin-action
      sweep already runs in the gate; the Neo4j driver is lazy, so nothing connects.
- [x] Security: `servers: /` makes Try it out same-origin with the visitor's own session cookie. That is the intended
      behavior, and the description says so.
- [x] Scope creep: none beyond the documented Deviations.

## House rules check

- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint/typecheck/build tooling. The coverage suite is a test in the existing runner, not a linter.

## Product-guide adherence

N/A (no PRD; the book's acceptance frame is the anchor).

## Findings

### Blocking

None.

### Non-blocking

1. **src/api/openapi.yaml:1886-1887 (and the goal-family entries at :1975, :2057, :2198, :2286, :2365, :2510)**: these
   entries say refusals carry "a `refusal` and an `error`". The cores also answer HTTP 200 `{success: false, error}`
   with no `refusal` when the `tapestry owner goal` concept is absent (`index.js:2239`, `:2356`, `:2571`, `:2876`,
   `:2958`, `:3215`, `:4827`), which is the likely first answer on a fresh instance. A few rarer unnamed failures do
   the same: an unreadable goal or resource record (`:2378`, `:2682`), and a missing assistant identity in restore-brain
   (`:5043`). The 200 schemas already allow it, so nothing is wrong, but a client keying on `refusal` would miss it.
   Optional: one clause per entry, "or success false with only an `error` when the goal concept isn't on this
   instance".
2. **src/api/openapi.yaml:2760-2762, :2799-2801**: trusted-dictionary-snapshot doesn't say that `wotPov: user` falls
   back to the house point of view when this instance holds no scores for that pubkey
   (`src/api/adoption/index.js:156-175`), nor that the answer's `snapshot.pov` is then `house` (otherwise
   `personalized`, never `user`). The pubkey must also be lower-case hex. Optional: add the fallback sentence and
   `enum: [house, personalized]` on `pov`.
3. **src/api/openapi.yaml:2448, :2483**: `proposalId` has no description. It is the proposal's `slug`, from
   make-proposal's `proposal.slug` (`index.js:3332`). Optional: say so, or a Try it out user can't find the value.
4. **src/api/openapi.yaml:6352-6353**: `NotSignedIn` has no content, but the middleware's 401 is JSON
   `{success: false, error}` (`src/middleware/auth.js:329-331`, `:405`). Optional: give it the `ErrorResponse`
   schema like `NotOwnerOrAdmin`.
5. **test/openapi-coverage.test.js:270**: C6 checks `lines.length <= GAP_CEILING`. Today the two are equal, so the list
   is tight. A later story that documents routes but forgets to lower the ceiling leaves free slots, and a new route
   could then be listed instead of documented without any test failing, so the list would no longer be strictly
   shrink-only. Optional, for the Tester in the next story of this epic: make it `===`, so every documented area has
   to lower the ceiling and any growth shows as a raise in the diff.
6. **test/openapi-coverage.test.js:233**: M2's real-document assertion only runs while
   `'/api/settings/{keyPath}'` is a quoted key. If that key is re-quoted or unquoted, the check passes vacuously.
   Minor; the fragment half of M2 still covers quoted keys.
7. **src/api/openapi.yaml:104, :151** (pre-existing, out of scope): the Auth entries `$ref`
   `#/components/schemas/AuthVerifyResponse`, which doesn't exist (since the file's first commit, `a898f190a`), so
   Swagger shows a resolver error when those two entries are opened. P1 opens only the 20 new entries, so it can't see
   this. Not filed anywhere I could find (OPEN.md, `ledger/`, `_intake.md`). Recommend an `_intake.md` entry or OPEN
   row for a later story of this epic.
8. **BIBLE.md:8** (optional): the `**Last updated:**` header still reads 2026-10-28 and has no entry for this
   paragraph. Recent BIBLE edits are mixed on this, L9 allows 14 days (today's lag is 9), and nothing fails, but a
   one-line entry would keep the header's changelog complete.

### Harness friction

1. None new. The router-patch suite's macOS failure that showed in the regression run is already
   `ledger/2026-10-09-router-patch-sed-macos.md`.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story status flipped to Done in place, and this review linked from the story's Linked artifacts, by the
      launching session in the review commit (this Reviewer was asked not to edit the story or commit).
- [x] The launching session re-checked non-blocking findings 1, 2, 4 and 7 against the code before committing
      (`index.js:2239`, `src/api/adoption/index.js` `resolveQualifying`, `src/middleware/auth.js:329-331`, and no
      `AuthVerifyResponse` under `components.schemas`); each holds. Finding 7 is filed as OPEN.md row
      `2026-11-07-openapi-auth-verify-missing-schema`.
- [x] Completion detection: run by the launching session; the result goes to the owner in chat, not in this file.

## Addendum — round 2 (non-blocking findings 1–4 fixed, `37d68b06c`)

The owner chose to fix findings 1–4 before closing the book. Each fix was re-derived from the code as a fresh claim,
not taken from the finding's wording:

| Finding | Fix in `src/api/openapi.yaml` | Checked against |
|---|---|---|
| 1 | create-child-goal, update-goal-intent, create-resource, create-work-record, note-goal-idea, make-proposal and record-priority-signal say that with no `tapestry owner goal` concept they answer 200 with success false and only an `error`; update-goal-intent adds an unreadable goal record, verify-resource an unreadable resource record, restore-brain a missing Assistant identity. Their 200 descriptions say "a named refusal, or success false with only an error". | `index.js:2239`, `:2356`, `:2378`, `:2571`, `:2682`, `:2876`, `:2958`, `:3215`, `:4827`, `:5043` — each `return { success: false, error }` with no `refusal` |
| 2 | trusted-dictionary-snapshot: a user point of view needs a lower-case 64-hex `userPubkey` and falls back to the house's when this instance has no scores for it; `snapshot.pov` is `enum: [house, personalized]`. | `src/api/adoption/index.js:156-158` (`/^[0-9a-f]{64}$/`, `branch = 'house'`), the fallback in `resolveQualifying`, and `pov: { branch, … }` in `assembleTrustedDictionary` |
| 3 | approve-proposal and skip-proposal describe `proposalId` as the proposal's slug, make-proposal's `proposal.slug`. | `index.js:3332` (`records.find((r) => r.type === 'proposed' && r.slug === proposalId)`) |
| 4 | `components.responses.NotSignedIn` carries the `ErrorResponse` schema. | `src/middleware/auth.js:329-331` (`refuse` → `res.status(status).json({ success: false, error })`) and `:391`, `:398`, `:405` (every 401) |

Re-run after the fix: `node test/openapi-coverage.test.js` 12 passed, 0 failed; `node test/openapi-document.test.js`
10 passed, 0 failed. All 166 older path entries parse identical to `8198c8ad4`. Every `$ref` in the document resolves
except `#/components/schemas/AuthVerifyResponse` (finding 7, OPEN.md row `2026-11-07-openapi-auth-verify-missing-schema`).
The browser spec on a scratch stack built from `37d68b06c`'s tree: 3 passed, none skipped; the scratch instance's
nginx log holds `"GET /api/normalize/node-primitives HTTP/1.1" 200 72 "http://127.0.0.1:18080/docs/"` from Chrome.
The forward and the scratch stack were removed. Findings 5, 6 and 8 stay open as written above (5 is for the Tester
of the next story in this epic).

The verdict stands: **PASS**.
