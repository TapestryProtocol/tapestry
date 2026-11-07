# Test Plan: Story 1 — The API docs say what they cover: a coverage test, the normalize routes, and Try it out on this instance

**Story:** `engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.md`
**ADR:** none. The story was classified Bug, and Architecture was skipped at the planning gate.
**Date:** 2026-11-06

## What the Tester wrote, and what the Implementer writes

The coverage gate the story asks for is a test suite, so the Tester wrote it: `test/openapi-coverage.test.js`,
in the same way the admin-action sweep's Tester wrote that sweep. It fails today only because its inputs are not
there yet. The Implementer:

- writes the gap list `test/fixtures/openapi-known-gaps.json`: every registered `/api/` route the document does
  not cover, one `"METHOD /path"` line each, with the path as registered (Express form, e.g. `/api/user/:pubkey/notes`).
  After the 20 normalize entries it is **196** lines. `findProblems` is exported from the suite, so the list can be
  generated from the suite's own rule, then sorted and checked by hand;
- documents the 20 normalize routes in `src/api/openapi.yaml`, from their handlers (table below) and BIBLE §11's
  rows;
- changes `servers`, `info.contact.url` and `info.description`, and BIBLE §11's "API Documentation" paragraph.

The Implementer edits no test file. If a test looks wrong, it goes back to the Tester.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC1 (runs on its own, passes, exits non-zero on a failure) | R1 `node test/openapi-coverage.test.js` prints a result per test and a summary, exit 0 exactly when none failed | `test/openapi-document.test.js` | process |
| AC1 (stack-free, in the registry) | R1 both suites listed in `test/registry.js`; run under the stack-free runner (§ How to run) | `test/openapi-document.test.js` | unit |
| AC1 (counts what the server registers) | W1 the child walk returns the whole router (300+ `/api/` routes, no register error, no router-file write) | `test/openapi-coverage.test.js` | process |
| AC1 (the entrypoint's own routes) | E1 `bin/control-panel.js` registers no `/api/` route itself today; one added to it is found | `test/openapi-coverage.test.js` | unit |
| AC1 (matching) | M1 `:param`, `{param}`, `*` are one segment; the method counts; trailing slash ignored; a documented HEAD rides on GET | `test/openapi-coverage.test.js` | unit |
| AC1 (quoted keys) | M2 single- and double-quoted keys read like plain ones, in a fragment and in the real document (`'/api/settings/{keyPath}'` documents `DELETE /api/settings/*`) | `test/openapi-coverage.test.js` | unit |
| AC2 (the list's format) | G1 the gap list exists; every line is `"METHOD /api/…"` | `test/openapi-coverage.test.js` | unit |
| AC2 (a) | C2 every registered route has an entry or a gap-list line, else it is named | `test/openapi-coverage.test.js` | integration (walk) |
| AC2 (b) | C3 no gap-list line names a documented route | `test/openapi-coverage.test.js` | integration (walk) |
| AC2 (c) | C4 every documented method and path is registered | `test/openapi-coverage.test.js` | integration (walk) |
| AC2 (d) | C5 every gap-list line is registered, none twice | `test/openapi-coverage.test.js` | integration (walk) |
| AC2 (each rule names, then clears) | D1 the rules on made-up sets | `test/openapi-coverage.test.js` | unit |
| AC2 (shown in a throwaway copy) | D2 the suite run inside a temp copy of the tree: the unchanged copy passes; with a route added to `src/api/index.js` and no entry, and a documented route's line put on the gap list, it exits non-zero, C2 naming the route and C3 the line | `test/openapi-coverage.test.js` | process |
| AC3 (196, only shrinks) | C6 the gap list holds at most `GAP_CEILING` = 196 lines. With C2, the list holds exactly the undocumented routes, so it is 196 unless more is documented | `test/openapi-coverage.test.js` | unit |
| AC3 (none under `/api/normalize`) | C2 + N1: every normalize route has an entry, so C3 forbids a normalize line | both | — |
| AC3 (an entry each) | N1 each of the 20 has an entry under its method, tagged Normalize, with a summary | `test/openapi-document.test.js` | unit |
| AC3 (who may call it) | N2 from `resolveRouteAccess`: an owner action names the owner, admins and direct-local callers and answers 401 and 403; a public read says anyone may call it and answers neither | `test/openapi-document.test.js` | unit |
| AC3 (its body) | N3 each POST has a JSON body schema with every field its handler reads from `req.body` (plus the four intent fields where the handler passes the body to `pickIntentFields`) | `test/openapi-document.test.js` | unit (source scan) |
| AC3 (its answers) | N4 a 2xx JSON answer, and every status the handler sends | `test/openapi-document.test.js` | unit (source scan) |
| AC3 (agrees with BIBLE) | N5 for the 5 routes with a §11 row: every status the row names is documented; every name in its backticks appears in the entry | `test/openapi-document.test.js` | unit |
| AC4 (servers, contact, description) | S1 one server, url `/`; S2 the gitworkshop URL; S3 the description says Try it out sends real requests to this instance with your session | `test/openapi-document.test.js` | unit |
| AC4 (scratch stack: loads, shows, reaches) | P1 `/docs` loads: title, no Swagger error panel, no page or console error; P2 the 20 routes under Normalize; P3 Try it out → Execute on `GET /api/normalize/node-primitives`: Request URL is the page's own origin, 200, `"surface": "node-primitives"` | `tests/brainstorm/openapi-docs.spec.js` | browser (opt-in) |
| AC4 (it reached the scratch instance) | After P3, the scratch container's nginx access log holds the request (§ How to run, step 5) | manual, recorded in the review | live |
| AC5 | B1 BIBLE §11's "API Documentation" paragraph: no "all REST endpoints"; names `/docs`, `test/openapi-coverage.test.js`, `test/fixtures/openapi-known-gaps.json` | `test/openapi-document.test.js` | unit |

## The 20 routes, from their handlers

What N3 and N4 see today, for the Implementer and the Reviewer. "Access" is the route table's. Every owner action
also answers 401 (signed out) from the middleware.

| Route | Handler (file) | Access | Statuses the handler sends | Body fields the handler reads |
|---|---|---|---|---|
| POST `reconcile-primary-property` | `handleReconcilePrimaryProperty` (index.js) | owner | 400, 403, 500 | concept |
| POST `create-child-goal` | `handleCreateChildGoal` (index.js) | owner | 400, 403, 500 | parent, name, statement, deliverable, boundary, origin, capturedOn + intent fields |
| POST `update-goal-intent` | `handleUpdateGoalIntent` (index.js) | owner | 400, 403, 500 | goal, deliverable, boundary, parent + intent fields |
| POST `create-resource` | `handleCreateResource` (index.js) | owner | 400, 403, 500 | goal, title, locatorKind, locator, whyKept, keywords |
| POST `verify-resource` | `handleVerifyResource` (index.js) | owner | 400, 403, 500 | goal, locator, reachable |
| POST `create-work-record` | `handleCreateWorkRecord` (index.js) | owner | 400, 403, 500 | goal, session, summary, questions, produced |
| POST `note-goal-idea` | `handleNoteGoalIdea` (index.js) | owner | 400, 403, 500 | name, statement, session + intent fields |
| POST `make-proposal` | `handleMakeProposal` (index.js) | owner | 400, 403, 500 | goal, whyNow, passedOver |
| POST `approve-proposal` | `handleApproveProposal` (index.js) | owner | 400, 403, 500 | proposalId |
| POST `skip-proposal` | `handleSkipProposal` (index.js) | owner | 400, 403, 500 | proposalId, reason |
| POST `record-priority-signal` | `handleRecordPrioritySignal` (index.js) | owner | 400, 403, 500 | prefers, over, reason |
| POST `restore-brain` | `handleRestoreBrain` (index.js) | owner | 400, 403, 500 | artifact |
| POST `record-restore-drill` | `handleRecordRestoreDrill` (index.js) | owner | 400, 403, 500 | exportTakenOn, outcome, target |
| POST `adoption-disposition` | `handleAdoptionDisposition` (index.js) | owner | 400, 403, 500 | target, disposition |
| POST `trusted-dictionary-snapshot` | `handleTrustedDictionarySnapshot` (index.js) | owner | 403, 500 | wotPov, userPubkey |
| POST `add-relationship` | `handleAddRelationship` (relationships.js) | owner | 400, 403, 404, 500 | (through `gateAndValidate`: fromUuid, toUuid, relType — N5 checks these via BIBLE) |
| POST `delete-relationship` | `handleDeleteRelationship` (relationships.js) | owner | 400, 403, 404, 500 | (as add-relationship) |
| GET `relationship-primitives` | `handleRelationshipPrimitivesProbe` (probe.js) | public | — (200 only) | — |
| POST `add-subset` | `handleAddSubset` (nodes.js) | owner | 400, 403, 404, 409, 500 | parentUuid, name, description |
| GET `node-primitives` | `handleNodePrimitivesProbe` (nodePrimitivesProbe.js) | public | — (200 only) | — |

The intent fields are `INTENT_FIELDS` in `src/lib/brain/goals.js`: prompt, chanceOfSuccess, needsHumanInput,
needsBreakdown.

## Edge cases

- [x] A parameter spelled differently in the code and the document (`:pubkey` vs `{pk}`), a wildcard against a
      named parameter (`*` vs `{keyPath}`), a trailing slash, a deeper path with the same prefix, the same path
      under another method, a documented HEAD (M1).
- [x] Quoted path keys, single and double (M2), the case that misled the first count.
- [x] A route registered twice (`POST /api/firmware/install` today): counted once (the matching key).
- [x] A route registered through a path constant or a loop: seen, because registration is read from the walk, not
      from source text (the 13 the issue's count missed).
- [x] A route the entrypoint registers itself (E1). Limit: E1 sees literal paths only; none exist today.
- [x] A malformed, stale or doubled gap-list line (G1, C5), and a list that grows (C6).
- [x] A YAML document that doesn't load: js-yaml throws (duplicate keys included) and every C-test fails with it.
- [x] Statuses sent through a local helper (`fail(res, 404, …)` in nodes.js), through a same-file function handed
      `res` (`respondMissingNodes` → 404), and through a validator's returned status (`gateAndValidate` →
      `status: 403/400`): all seen by N4, each proven by a mutation.
- [ ] **Not seen by N3/N4, for the Reviewer to check by hand:** a status or field reached only through another
      module (e.g. what `decideProposal` or `serializeGoalWrite` throw becomes the 500 already listed); the shape
      of each success answer (N4 checks only that a JSON schema exists); enum values (`disposition` ∈ declined,
      requeued; the `relType` whitelist); that the summaries and descriptions are true to the handler. The review
      is the accuracy audit for the 20 entries.
- [ ] Not covered, by the story's scope: the content of the 171 entries already there; who-may-call for routes
      outside the 20.

## Test infrastructure

- Node suites: the repo's own runner (`test()` + `run()` + a `require.main` block), registered in `test/registry.js`.
  Stack-free: no running instance, no container, no network. The walk runs in a child process with temp settings,
  conf and base dir, as the admin-action sweep's does. D2 copies `src/`, `lib/`, `firmware/`, the entrypoint, the
  suite, the walker and the gap list (about 8 MB) into the OS temp dir and removes it afterwards.
- Browser spec: Playwright, chromium, opt-in (`OPENAPI_DOCS_SCRATCH=1`). It skips otherwise, so a plain Playwright
  run never opens `/docs` on whatever answers at the default base URL (on this Mac, Grawk's instance at :7778).
- Scratch stack: `scripts/scratch-stack.sh` (no published ports) plus a loopback-only forward from the same image,
  so a browser on the host can reach it (§ How to run). Firmware is installed by the script; nothing else needed.
- Fixtures: the gap list (the Implementer's), `test/helpers/openapiNormalizeRoutes.js` (the 20 routes, shared by
  the document suite and the spec).

## How to run

The Node suites, one at a time, on this Mac with the stack-free runner (dead ports, a `docker` that refuses, no
container; memory `screen-suites-for-docker-exec`). Never the full `npm test` here without asking the owner.

```bash
node test/openapi-coverage.test.js
node test/openapi-document.test.js
```

The browser check, on a scratch stack built from the branch:

1. `TAPESTRY_CONTAINER=$(bash scripts/scratch-stack.sh up)` (mounts this checkout's `src/`; about 2–3 GB). Run it
   from a checkout under `/Users`: Docker Desktop doesn't share `/private/tmp`, so a tree in a session scratchpad
   mounts as an empty `src/`, and the script gives up after 7.5 minutes with "the scratch app did not come up in
   time" (seen 2026-11-06). The Tester's oracle lived in the worktree's git-ignored `tmp/` for this reason.
2. Forward it to the host's loopback only, from the same image (nothing is pulled):

   ```bash
   docker run -d --rm --name tapestry-scratch-fwd --network tapestry-scratch-net -p 127.0.0.1:18080:18080 --entrypoint node tapestry-tapestry -e "const n=require('net');n.createServer(c=>{const u=n.connect(80,'tapestry-scratch');c.pipe(u).pipe(c);u.on('error',()=>c.destroy());c.on('error',()=>u.destroy());}).listen(18080)"
   ```

3. `OPENAPI_DOCS_SCRATCH=1 BRAINSTORM_BASE_URL=http://127.0.0.1:18080 npx playwright test tests/brainstorm/openapi-docs.spec.js --project=chromium --reporter=line`
4. Read the passed count, not only the failed one: all three must pass, none skip.
5. Proof it reached the scratch instance: `docker exec tapestry-scratch sh -c "grep -h 'GET /api/normalize/node-primitives' /var/log/nginx/*access*.log | tail -3"` shows the request with the browser's user agent.
6. Afterwards: `docker rm -f tapestry-scratch-fwd`, then `bash scripts/scratch-stack.sh down` (the network can't be
   removed while the forward is attached).

## Verification

The new tests fail with the current code. Confirmed on 2026-11-06 at `4e147f890` plus this phase's files, with the
stack-free runner:

```
=== openapi-coverage ===
  PASS  W1  PASS  E1  PASS  M1  PASS  M2
  FAIL  G1: … the gap list test/fixtures/openapi-known-gaps.json does not exist yet (story AC2)
  FAIL  C2, C3, C5, C6: (the same reason)
  PASS  C4  PASS  D1
  FAIL  D2: the unchanged copy must pass the suite before the demo means anything; it exited 1 (G1…C6 in the copy)
openapi-coverage: 6 passed, 6 failed, 0 skipped

=== openapi-document ===
  FAIL  S1: servers must be exactly one entry with url "/"; got [localhost:8080, localhost:7778]
  FAIL  S2: info.contact.url must be https://gitworkshop.dev/…/Tapestry; got "https://github.com/nous-clawds4/tapestry"
  FAIL  S3: info.description … lacks "Try it out", "this instance", "real"
  FAIL  B1: BIBLE §11 "API Documentation": still says "all REST endpoints"; does not name test/openapi-coverage.test.js; does not name test/fixtures/openapi-known-gaps.json
  FAIL  N1–N4: the 20 routes, each "(no entry)"   FAIL  N5: the 5 BIBLE-row routes, each "(no entry; BIBLE has a row)"
  PASS  R1
openapi-document: 1 passed, 9 failed, 0 skipped
```

The tests that pass now are the gate's own machinery (the walk, the entrypoint scan, matching, quoted keys, the
rules on made-up sets) and C4 (nothing documented is unregistered, true today). R1 passes because the Tester
registered both suites.

**The tests can pass, and they bite (test-design oracle).** A throwaway implementation, outside the repo
(`git archive` of the branch plus generated entries for the 20 routes, the 196-line gap list, the three document
fields and the BIBLE line): both suites pass, 12/12 and 10/10, D2's throwaway-copy demo included. Then 21 mutations,
one rule each, each restored before the next. Every one fails exactly the tests that guard it:

| Mutation | Fails |
|---|---|
| a gap line removed | C2 |
| a documented route's line added to the list | C3, C6 |
| a documented path the server doesn't register | C4 |
| a stale line / a doubled line | C5, C6 |
| a malformed (lower-case method) line | G1 |
| add-subset loses 409 | N4, N5 |
| add-relationship loses 404 (sent by `respondMissingNodes`) | N4 |
| delete-relationship loses 400 (returned by `gateAndValidate`) | N4 |
| restore-brain loses `artifact` / create-child-goal loses `prompt` | N3 |
| approve-proposal stops naming admins / node-primitives documents 401 | N2 |
| relationship-primitives not tagged Normalize | N1 |
| add-relationship stops naming `HAS_ELEMENT` | N5 |
| verify-resource's entry removed | N1, N2, N3, N4 |
| a second server / the old contact / "session" gone from the description | S1 / S2 / S3 |
| BIBLE back to "all REST endpoints" | B1 |
| the registry drops openapi-document | R1 |

**The browser spec, on a scratch stack (2026-11-06).** One scratch instance, booted from the oracle tree, with the
document swapped and the control panel restarted between runs (`supervisorctl restart brainstorm`), reached through
the loopback forward at `http://127.0.0.1:18080`:

| Document served | Result |
|---|---|
| today's (`4e147f890`) | P1 passes; P2 fails, all 20 "(0 found)"; P3 fails, "no GET /api/normalize/node-primitives operation on /docs" |
| the oracle's | 3 passed |
| oracle, `servers` → `http://127.0.0.1:9` | P3 fails: Request URL `http://127.0.0.1:9/api/normalize/node-primitives`, expected `http://127.0.0.1:18080/…` |
| oracle, add-subset's 200 schema → a missing `$ref` | P1 fails: "Resolver error at paths./api/normalize/add-subset.post.responses.200…$ref" |

The first spec run showed two defects in the spec itself, fixed before these runs: P3 read the live-response
table's header cell ("Code") as the status, and P1 checked for errors only at load, but Swagger resolves an entry's
`$ref`s only when the entry is opened. P1 now opens all 20 entries first.

The scratch instance's nginx log shows the requests P3 sent, with `/docs` on the forward as their referer:
`"GET /api/normalize/node-primitives HTTP/1.1" 200 72 "http://127.0.0.1:18080/docs/" "… Chrome/141.0.7390.37 …"`.
The forward and the scratch stack were removed afterwards.

Not run: the full `npm test` (it publishes fixtures from this Mac, per the owner's standing rule), and
`test/stack-free-npm-test.test.js`, whose G2 runs a live suite against whatever control panel answers (here
Grawk's instance). That suite's G5 rule was checked directly instead: all 335 `test/*.test.js` files are
registered or excluded, and every listed file exists.
