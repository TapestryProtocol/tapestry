# Review: Story 1 — Declare each operation once: the `/api/tapestry/` routes, their sign-in, and `lifecycle status`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-08
**Diff:** `git diff 896b284bd...HEAD` (HEAD `114bf9a7b`: story `c7fab4729`, ADR `f0ba46ffb`, failing tests `9e0008c75`, implementation `8e9de219b`, evidence `114bf9a7b`)
**Story:** [1-operation-declaration-and-lifecycle-status.md](../../stories/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md) · **ADR:** [0001-declare-each-operation-once.md](../../decisions/graph-operations-foundation/0001-declare-each-operation-once.md) · **Test plan:** [1-…test-plan.md](../../stories/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.test-plan.md)

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test`: not run. On this machine the full gate's live suites can publish fixtures to public relays, and port 7778 belongs to a private instance (this review's environment rule). There is no run record to quote: `npm run gate:status` printed `no gate run records in <worktree>/tmp/gate-runs` (exit 2). CI runs the full stack-free gate on the pull request, and that is the full-gate result.
- [x] **Suites run one by one** through their `run()` exports, on Node 24.18.0 at `114bf9a7b`. I used the session's runner (HTTP endpoints, `TAPESTRY_PORT` and `TAPESTRY_CONTAINER` set dead inside it) and also exported `NEO4J_URI=bolt://127.0.0.1:9`, `REDIS_HOST=127.0.0.1` and `REDIS_PORT=9` (Harness friction 2). Results are pass/fail/skip.
  - **The story's suites:**
    - `operations`: 43/0/0 (its 36 tests and the 7 of `test/operations/lifecycle/status.test.js`).
    - `openapi-coverage`: 13/0/0.
  - **Red before green:** the same two suites, run on an export of `9e0008c75`, give 1/42 and 7/6. That matches the test plan's Verification and the story's Evidence. Phase 4 left `test/` untouched: `git diff 9e0008c75..HEAD -- test/` is empty.
  - **The suites the change touches:** every top-level suite that names the route table, the route walker, `src/api/index`, the entrypoint, the Dockerfile, the API document, `tapestry-key` or `api/firmware`, after screening. That is 75 suites: 2,039 passed, 3 failed, 63 skipped.
    - Among them: `admin-action-sweep` 9/0, `admin-action-sweep-access` 13/0, `default-deny-mutations` 14/0, `openapi-document` 10/0, `task-routes-owner-admin` 5/0 and `tapestry-key-put-await` 3/0.
    - The skips are live-API tests with no reachable panel.
    - Separately, `stack-free-npm-test` gave 6/0/1. G5 passes (the registry is complete); G2 skips without a live panel.
  - **The 3 failures** are `router-stream-limit-on-connect` P1–P3. BSD sed reports "invalid command code f" (the suite's header asks for GNU sed). The same three fail on an export of the base `896b284bd`, and the diff touches no script, so they are not this change's. That suite's Dockerfile tests pass with this Dockerfile.
  - **Left out:**
    - 18 suites the screen matched: adoption-candidates-queue, author-scoped-inspection-roster, b-coverage-audit-and-disposition, brain-first-tapestry-authoring, brains-launcher-repo, capture-a-goal-and-see-it, community-class-thread-pull, community-reference-nostr-relay-stub, create-concept-duplicate-check, dlist-curation-header-endpoint, event-less-create-set, list-headers-me-disposition, list-headers-my-assistant-disposition, profile-tags-publish, shared-by-me, state-on-concept-page, tapestry-per-concept-detail-views and treasure-map-relay-presence.
    - `event-tagging-firmware-seed`, which passes the screen but hardcodes `localhost:7778` and `:8877` (Harness friction 1).
  - **Screen matches run after reading them:**
    - `admin-action-sweep-access`: the match is a route path in its allowlist data, and its harness mounts marker handlers on its own loopback app.
    - `default-deny-mutations`: fake request objects only.
- [ ] `npm run test:playwright`: not applicable (no UI).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.**

  | AC | Passing tests | Also checked by the reviewer |
  |---|---|---|
  | AC1 status | `H1`, `H4`; `P1`–`P7` | The real readers are `readInstallState()`, exported unchanged, and `readTapestryKeyCounts()`. `git diff -w` shows the latter changed only at the function boundary, and `P7` pins that `GET /api/tapestry-key/status` still answers `{ success, data }`. `runCypher` throws when Neo4j is down, so firmware then answers `known: false`, never a false `none`. |
  | AC2 who may call | `H5`, `H6`, `H7`, `L2`, `R1`, `R2` | The router alone, with no central check, refuses a visitor 401, a stranger 403, a not-strictly-`true` session 401 and an unstamped loopback caller 401. |
  | AC3 the command | `C1`–`C8`, `X2` | Command and route read the same state in the container (see the live check below). |
  | AC4 `/docs` | `D1`–`D5`; coverage `C2`–`C5`, `V1` | See ADR adherence, `/docs` merge. |
  | AC5 inputs | `H8`–`H11`, `C4` | Hostile names, below. |
  | AC6 own files | `X1`, `X2`, `S1` | Both copied gates have a `require.main` block, so X1's exit-0 checks are real runs. `OPENAPI_COVERAGE_SKIP_DEMO` skips only D2's recursion. |
  | AC7 the list | `H13`, `H14`, `X2` | |

- [x] **No criterion is silently dropped.**
  - The live check in the story's Evidence was not reproduced: no container may be started on this machine. The test plan names it as the one check that isn't a gate suite.
  - **What I could check:**
    - Its numbers are internally consistent: 2,533 + 609 = 3,142, and 428 + 0 + 2,105 = 2,533.
    - The active firmware is `1.0.0`, with 39 concepts.
    - The command reads what the route reads. Both run as root with `HOME=/root`, so both open `/root/.tapestry/lmdb` (nothing sets `TAPESTRY_LMDB_PATH`). Everything status reads goes through `getConfigFromFile` or the TA helper, both of which read `/etc/brainstorm.conf` directly. So the command doesn't need the conf sourced into its environment, as `start-brainstorm.sh` does for the panel.
- [x] **No behavior is added that isn't in the story.** Each Deviation sits inside the ADR. The one inaccurate sentence among them is non-blocking 2.
  - The epic file and the book's line are Phase 1's.
  - The A10.3 naming squares with the rest: the epic's "a tapestryKey on every node" is catalog §8's `migrate`, which covers missing tapestryKeys.

## ADR adherence

- [x] **Files changed match the ADR's implementation notes.**
  - Decision 1's ten module files, and `bin/tapestry.js` at mode 100755.
  - `src/api/index.js:482–486` registers right after the firmware API.
  - `src/middleware/routeAccess.js:466` writes the list's entry after the tapestry-key entries, and `:504` spreads the generated entries into the frozen table, where the validation loop checks them.
  - `bin/control-panel.js:318` serves `withOperationDocs(yaml.load(…))`.
  - `Dockerfile:102–104` links the command after the `COPY` layer, with no `package.json` bin.
  - The two exports.
- [x] **Layering and module boundaries are respected.**
  - **Access values:** exactly two (`declaration.js:25`, `:79–81`). There is no value for visitors or ordinary signed-in people.
  - **Route table:** keys are `<METHOD> /api/tapestry/<group>/<name>`, names are restricted to `[a-z0-9-]` and groups to a fixed list, so no path-to-regexp syntax can be injected.
    - For `GET` and `HEAD` status, `GET` list, and a capitalised trailing-slash variant, the only table entry that matches is the route's own. Since the table is total, no other registered route can shadow them. The only `USE` mount is `/admin/queues`.
    - `routeTable.js` doesn't require `auth.js`.
  - **The re-check** (`http.js:20–39`) mirrors the central check's comparisons and messages. It is stricter on `authenticated === true` and fails closed without the central stamp.
  - **`/docs` merge:**
    - Apart from the generated entries, the served document deep-equals the YAML.
    - The YAML holds no value the JSON copy would alter.
    - No `operationId` collides.
    - A hand-written entry for a generated path throws (`D4`).
  - **The command:**
    - Stdout carries only the JSON, indented two spaces, and `console.log`/`info`/`debug` go to stderr during a run.
    - Exit codes are 0, 1, 2 and 3.
    - The bin exits in stdout's write callback.
    - The symlink resolves to the real `bin/`, so relative requires work.
  - **No side effects at load:** `status.js` requires lazily (`L4`). What the firmware and tapestry-key modules do when loaded is in-memory: requires, and `registerAll()`.
  - The two API-module reads are the debt the ADR names.
- [x] **No new dependencies the ADR didn't authorize:** `package.json` is unchanged, and ajv 8 was already a dependency.

## Concept-graph integrity

- [x] **Handles** are in `kind:pubkey:slug` form. The only one is `39998:<TA>:<slug>`, built inside the unchanged `readInstallState()`, with the TA resolved at runtime (`getTAPubkey` → `getOwnerAssistantPubkey`). There is no TA literal in the diff.
- [x] **Firmware reinstall:** not needed. No concept definition changed, and the ADR says so.
- [x] **Orientation via `/api/concept-graph/summaries`:** not applicable, since there is no concept work. The ADR records the stack-absent branch.

## Things tests can't catch

- [x] **No secrets.** A scan of the added lines for 64-hex strings, `nsec1`, key blocks and secret assignments found none.
- [x] **No leftover debug logging.** The one console call in `src/operations/` is `http.js:71`'s load-problem warning (ADR Decision 4).
- [x] **No commented-out code**, and no TODOs.
- [x] **Error paths** are handled where it matters now: a failing part answers `known: false`, an undeclared refusal is a 500, and an invalid declaration is left out and reported. A failure the current catalog can't reach is non-blocking 1.
- [x] **Concurrency.** Loading is synchronous and cached per folder. `cli.main`'s console swap is restored in `finally`, and only the bin calls it.
- [x] **Security.**
  - **Who can reach the routes:** a visitor or an ordinary signed-in person is refused at the table, whose entry or fail-closed default is `owner`, and again at the handler. Local trust needs the central check's stamp.
  - **No prototype pollution or injection.** CLI flags `--__proto__`, `--constructor`, `--toString` and `--__proto__.polluted=1`, and a JSON body with its own `__proto__`, are each refused as `unknown-input`, and `Object.prototype` stays clean. `qs` drops prototype-named query keys (non-blocking 3). Status takes no input, and its queries are static.
  - **Error text:** it reaches only owner, admin and local callers, and carries no secrets (but see non-blocking 2).

## House rules check

- [x] **Concept Graph API authority** is respected: there is no concept work.
- [x] **No new lint, typecheck or build tooling.**

## Product-guide adherence *(when the story traces to a PRD)*

- [ ] Not applicable. The story traces to a book and a design doc, not a PRD with style and design guides, and it has no UI.

## Findings

### Blocking

None.

### Non-blocking

1. **`src/operations/http.js:43–49` (with `src/operations/index.js:104–108`): an unserializable result takes the control panel down.**
   - If an operation's result can't be turned into JSON (a BigInt, a cycle), `res.json` throws inside the async handler, after `run`'s try/catch.
   - Express 4 doesn't catch a rejected handler, and `bin/control-panel.js` has no `unhandledRejection` handler, so Node 24 ends the control-panel process.
   - **Probe:** a throwaway declaration returning `{ n: 10n }`, on a loopback app. The process exited 1 with "Do not know how to serialize a BigInt", and the request got no answer. The command turns the same case into exit 3, with the error on stderr.
   - `lifecycle status` can't trigger it: it returns counts and strings, and `runCypher` converts Neo4j integers.
   - **Optional improvement:** catch around the handler's body, or check inside `callOperation`'s try that `data` serializes, and answer the ADR's 500 `failed`. Do it before more operations land; A10.4 extends `http.js` anyway.
2. **`src/operations/index.js:75`: a load problem carries absolute paths.**
   - A declaration that fails to `require` puts `e.message` into `problem`, and that message includes the absolute require stack. It reaches the list's `problems`, the command's stderr and the startup log.
   - So the story's Deviation (line 76), "so the list never carries an absolute path", overstates: only `file` is relative.
   - It's seen only by the owner, admins and local callers, and holds no secret. `L1` keeps the real catalog problem-free.
   - **Optional improvement:** keep the message's first line, or reword the Deviation.
3. **`src/operations/inputs.js:47–54` (via Express's `qs`): prototype-named query keys are dropped silently.**
   - `qs` drops prototype-named query keys (`?toString=1`, `?constructor=x`, `?__proto__[x]=1`) before the checker sees them. The route answers as if no input was given, while the command refuses `--toString` as `unknown-input`.
   - It's harmless: nothing reaches the operation, and nothing is polluted.
   - **No change needed;** it's only a small exception to AC5's "the same call the same way".
4. **For A10.4, the write path: cross-site POSTs.**
   - `http.js:47` takes `req.body` from whichever parser ran, and `bin/control-panel.js:124–125` mounts both `express.json` and `express.urlencoded`.
   - The session cookie sets no SameSite (`bin/control-panel.js:237–240`), so protection from cross-site POSTs rests on browser defaults.
   - **Optional improvement:** when writes land, consider refusing a write whose `Content-Type` isn't `application/json`. A cross-site form can't send that without a preflight.

### Harness friction *(each becomes an OPEN.md row, type `meta`; this review writes no other file)*

1. **The suite screen misses hardcoded local URLs.**
   - The screen given for this review (and used in Implementation) looks for `docker exec`, `dockerCurl`, `TAPESTRY_PORT`, `TAPESTRY_CONTAINER`, `strfry/publish` and `nak`. It misses suites that hardcode local URLs.
   - `test/event-tagging-firmware-seed.test.js:127,137,140,151` calls `http://localhost:8877/…` and `http://localhost:7778/…` with no `BRAINSTORM_BASE_URL` fallback.
   - On this Mac an `ssh` process listens on `*:7778`, as well as `:7687`, `:6379`, `:7777`, `:7474` and `:80`.
   - **Fix:** widen the screen to `localhost:7778|127\.0\.0\.1:7778|:8877`, or make that suite honor `BRAINSTORM_BASE_URL`.
2. **The runner leaves Neo4j and Redis live.**
   - The runner sets the HTTP endpoints, `TAPESTRY_PORT` and `TAPESTRY_CONTAINER` dead, but not `NEO4J_URI`, `REDIS_HOST` or `REDIS_PORT`.
   - A child whose conf lacks those keys falls back, through `getConfigFromFile`'s `source` step, to the inherited environment and then to `bolt://localhost:7687`. The route walker's child, for one, gets an empty conf (`test/operations.test.js:299`). This Mac's tunnel answers on that port.
   - **Fix:** add those three to the runner. I exported them myself for these runs.
3. **The runner exists only in a session scratchpad.** The test plan's "How to run" (`node <runner> …`) depends on it, so another session or machine can't reproduce the runs. Commit it beside the test helpers.

## Verdict

**PASS**

## On PASS (same commit)

- [ ] **Story status flipped to Done in place:** left to the orchestrator, as instructed. This review writes no other file and commits nothing.
- [x] **Completion detection** was performed. Its result is in the chat, not in this file.
