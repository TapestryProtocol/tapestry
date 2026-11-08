# Test Plan: Story 1 — Declare each operation once: the `/api/tapestry/` routes, their sign-in, and `lifecycle status`

**Story:** `engineering-team/stories/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md`
**ADR:** `engineering-team/decisions/graph-operations-foundation/0001-declare-each-operation-once.md`
**Date:** 2026-11-08

Two new suites, one re-aimed suite and one helper. All of them are stack-free.

- **`test/operations.test.js`, the foundation suite.** It is registered in `test/registry.js`. After its own tests it runs every suite under `test/operations/` and counts their results with its own (ADR Decision 12).
- **`test/operations/lifecycle/status.test.js`, the operation's own suite.** The foundation suite finds it; it has no registry line. This is the pattern for every later operation.
- **`test/openapi-coverage.test.js`, re-aimed.** Its documented set is the served document: the YAML plus the generated entries (ADR Decision 6). It gains V1.
- **`test/helpers/operationsHarness.js`, a child-process harness.** It runs the real central auth middleware in front of `registerOperationRoutes` on ephemeral loopback ports, and runs the command in-process through `cli.main`.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC1: four parts for the owner and an admin, unchanged on repeat | `H1` four parts for the owner and an admin; asking twice gives the same answer | `test/operations.test.js` | integration (harness) |
| AC1 | `H4` a part that can't be read is `{ known: false, problem }`, and the call still succeeds | `test/operations.test.js` | integration |
| AC1 | `P1` backup says no graph backup is recorded; `P2` migrations says none is recorded | `test/operations/lifecycle/status.test.js` | unit |
| AC1 | `P3` firmware: version carried, and `all` / `some` (missing listed) / `none` | `…/status.test.js` | unit (child, API module replaced) |
| AC1 | `P4` cache: cached, empty and missing counts, and nodes with and without a tapestryKey | `…/status.test.js` | unit (child) |
| AC1 | `P5` exactly four parts; one part failing leaves the others standing | `…/status.test.js` | unit |
| AC1 | `L1` the repo's catalog loads cleanly and declares status as a read for the owner and admins, with no inputs | `test/operations.test.js` | unit |
| AC1, AC7 | `W1` `register(app)` registers `GET /api/tapestry/lifecycle/status` and `GET /api/tapestry/operations` | `test/operations.test.js` | structural (route walk, child) |
| AC2: who may call | `H5` visitor 401, stranger 403 (lower and upper case), each told who may call; direct-local let through | `test/operations.test.js` | integration |
| AC2 | `H6` an owner-only operation: owner and local 200; admin 403 from the operation's own check; stranger 403; visitor 401; runs only for those let through | `test/operations.test.js` | integration |
| AC2: a declaration opening an operation to visitors | `L2` `access: 'public'` and `'signed-in'` are reported invalid, naming the access field, and left out | `test/operations.test.js` | unit |
| AC2 | `H7` an invalid declaration's route is never served (owner 404, visitor 401, stranger 403) and never runs | `test/operations.test.js` | integration |
| AC2 | `R1` exact table entries for status and the list, both resolving to `owner`; `R2` generated entries follow access and kind, and none is generated for an invalid declaration or opens anything | `test/operations.test.js` | unit |
| AC3: the command | `C1` `tapestry lifecycle status` prints exactly the route's answer, exits 0, and puts nothing else on stdout | `test/operations.test.js` | integration (harness) |
| AC3 | `C2` `tapestry`, `tapestry help` and `tapestry --help` list every operation by group with its summary; `tapestry lifecycle` lists one group | `test/operations.test.js` | integration (the real `bin/tapestry.js`, child) |
| AC3 | `C3` an unknown group or operation exits 2, listing what exists (the real bin and the fixture catalog) | `test/operations.test.js` | integration |
| AC3 | `C5` an owner-only operation runs with no sign-in, with context `{ via: 'cli', caller.role: 'local' }` | `test/operations.test.js` | integration |
| AC3 | `C6` `bin/tapestry.js` has a node shebang and is executable; the Dockerfile links it as `/usr/local/bin/tapestry` | `test/operations.test.js` | structural |
| AC3 | `C7` an operation's console output stays off the command's stdout | `test/operations.test.js` | integration |
| AC3 | `C8` `tapestry <group> <name> --help` shows the inputs, the route and who may call it, and runs nothing | `test/operations.test.js` | integration |
| AC4: the `/docs` entry | `D1` the served document's entry for status: its group tag, summary, who may call, command, no parameters, the declaration's result schema, and responses 200/400/401/403/500 | `test/operations.test.js` | unit |
| AC4 | `D2` each entry follows its declaration (query parameters with their required flags, a write's JSON body, declared refusal statuses, owner only), invalid ones are left out, and an entry changes when its declaration does | `test/operations.test.js` | unit |
| AC4 | `D4` the loaded YAML is left unchanged, and a path the YAML already documents is refused; `D5` the entrypoint serves `withOperationDocs(yaml.load(…))` | `test/operations.test.js` | unit + structural |
| AC4: the coverage gate passes with no known-gaps line | `C2`–`C5` re-aimed to the served document; `V1` the served document keeps every YAML entry, adds the generated ones, and the gap list names no `/api/tapestry/` route | `test/openapi-coverage.test.js` | structural |
| AC5: inputs | `H8` unknown, missing, wrong-type and out-of-range inputs are each refused 400 with their code, naming the input; the operation ran only for the accepted calls (counted) | `test/operations.test.js` | integration |
| AC5 | `H9` query inputs are coerced (number, list, one value as a list of one, boolean), defaults are applied, and the context is `{ via: 'http', caller.role }` | `test/operations.test.js` | integration |
| AC5 | `H10` a write's JSON body is not coerced; an unknown or missing field is refused; a non-object body is `invalid-body`; a write is POST only | `test/operations.test.js` | integration |
| AC5 | `H11` status refuses any query input (`unknown-input`) | `test/operations.test.js` | integration |
| AC5 | `C4` the command takes inputs by name (`--name value`, `--name=value`, repeated for a list, bare for true) and refuses as the route does (exit 1, same JSON); a stray word exits 2; a declared refusal exits 1; a failure exits 3 | `test/operations.test.js` | integration |
| AC6: one operation, its own files | `X1` in a throwaway copy with only two new declaration files: the route walk registers them, the copy's table and served document hold them (owner read, owner-only action), and the sweep and the coverage gate pass | `test/operations.test.js` | integration (copy, children) |
| AC6 | `X2` in the same copy, the router answers the owner, an owner-only write refuses an admin, the list shows both, and the copy's `bin/tapestry.js` runs one with its JSON as the whole of stdout | `test/operations.test.js` | integration |
| AC6 | `S1` no file in `src/`, `bin/` or `test/registry.js` other than the declaration names status's route or path | `test/operations.test.js` | structural |
| AC7: the list | `H13` the owner's list gives each operation's group, name, route, method, command, access, kind, inputs, result (the declaration's schema) and refusals (built-in and its own); an admin's list includes status | `test/operations.test.js` | integration |
| AC7 | `H14` an admin's list leaves out owner-only operations; inputs carry `{ schema, required, description }`; the refusals listed match what each operation can return; `problems` names the invalid declarations but not helper files; visitor 401, stranger 403 | `test/operations.test.js` | integration |
| Decision 4 | `H12` a declared refusal answers at its own status with its code; an undeclared one is a 500 `failed` naming the operation | `test/operations.test.js` | integration |
| Decisions 1, 2, 9 | `L3` nine rule violations are each reported with their file and reason: no `run`, the `raw` group, an unknown group, a name that doesn't match the file, a schema that doesn't compile, a refusal repeating a built-in code, a bad `kind`, a non-4xx refusal status, no `summary`. A valid neighbour loads, and helper files are ignored. | `test/operations.test.js` | unit |
| Decision 10 | `L4` loading the catalog and the route table requires no Neo4j driver, LMDB, store or Redis module | `test/operations.test.js` | unit (child) |
| Decision 11, AC4 | `P6` every status answer, known or not, matches the declaration's own result schema (ajv) | `…/status.test.js` | unit |
| Implementation notes (the two exports) | `P7` `readInstallState` and `readTapestryKeyCounts` are exported, and `GET /api/tapestry-key/status` still answers `{ success: true, data: <counts> }` | `…/status.test.js` | unit (child, driver and store replaced) |
| Decision 12 | `T1` suites under `test/operations/` are found (nested ones too), their results add up, a file there without `run()` fails by name, and status has its own | `test/operations.test.js` | unit |

## Edge cases

- [x] Inputs: an empty catalog of inputs (status) refuses any input. A required input left out. A wrong type. Out of range. Text coerced for query strings and the command but not for JSON bodies. One query value as a list of one. Defaults applied (`H8`–`H11`, `C4`).
- [x] Capitalised paths are refused like lower-case ones (`H5`).
- [x] Refused calls never run the operation, paired with counted runs for the accepted ones (`H6`, `H7`, `H8`, `H10`), per the workflow's "did not happen" pitfall.
- [x] A part-reader failing (Neo4j down) answers that part as unknown, and the rest stand (`H4`, `P5`, `P6`).
- [x] Logging during a command run stays off stdout: in-process (`C7`) and in the real binary (`X2`).
- [x] A hand-written YAML entry for a generated path is refused, so no operation has two sources (`D4`).
- [x] Helper files beside a declaration are neither operations nor problems (`L3`, `H14`).
- [ ] **Not tested here: the real readers against a live graph.** `parts.firmware` and `parts.cache` read Neo4j and the LMDB, so the gate replaces them. The real reads are checked once in Implementation, on a scratch stack (`scripts/scratch-stack.sh`), never on a shared or private instance: `docker exec <scratch> tapestry lifecycle status`, and `GET /api/tapestry/lifecycle/status` as the owner. The answers must match.
- [ ] **Deliberately not pinned:** the wording of notes and messages, beyond naming the input or saying who may call; the order of operations in a list; the order of keys in an answer (compared key-order-free); and HEAD on the new routes, which Express answers like GET and the route table already pins (`R1` resolves HEAD).

## Test infrastructure

- **Framework:** Node's built-in runner, `npm test` (entry `test/test.js`, registry `test/registry.js`). A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate). No Playwright: there is no UI.
- **Concept Graph API:** not used. Every suite here is stack-free.
- **The harness** (`test/helpers/operationsHarness.js`) runs in a child process with:
  - `BRAINSTORM_CONF_PATH`: a temp conf holding the owner pubkey, `NEO4J_URI=bolt://127.0.0.1:9` and Redis on port 9;
  - `TAPESTRY_SETTINGS_PATH`: the admin list;
  - dead `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE` and `MEILI_URL_HOST`;
  - a temp `TAPESTRY_LMDB_PATH`.

  Sessions come from an `X-Test-Session` header, as `test/task-routes-owner-admin.test.js` does. Proxied callers send `X-Forwarded-For`; the direct-local caller sends none. Status's `parts.firmware` and `parts.cache` are replaced per scenario.
- **Seams the tests rely on** (ADR Decisions 1, 6, 7 and 11): `loadOperations({ dir })`, `registerOperationRoutes(app, { dir })`, `routeAccessEntries({ dir })`, `withOperationDocs(spec, { dir })`, `cli.main(argv, io, { dir })` returning the exit code, and status's `parts` object, called through at run time. Each loaded operation and each list entry carries `group`, `name`, `kind`, `access`, `method`, `route`, `command`, `inputs`, `result` and `refusals`. A load problem is `{ file, problem }`.
- **Fixtures:** temp catalogs written by the suite and removed at its end.
  - The fixture catalog: `graph/echo-inputs`, `graph/write-thing`, `graph/refusing`, `graph/noisy`, `lifecycle/owner-thing`, the invalid `graph/visible` (`public`) and `graph/signed` (`signed-in`), and two helper files.
  - A rules catalog with nine invalid declarations and one valid one.
  - A throwaway copy of the tree with only `graph/demo-echo` and `graph/demo-write` added. It reuses the coverage gate's D2 pattern: `src`, `lib`, `firmware` and `bin` are copied, `node_modules` is linked.
- **`node_modules` in a worktree:** the route walker loads `express` from `<root>/node_modules`, so a fresh git worktree needs one. These runs used a symlink to the main checkout's. CI installs it.
- **Firmware state:** none needed. P7 reads the in-repo active manifest.

## How to run

```
npm test
```

Or just these suites, as this session ran them, through each suite's `run()` export with the service endpoints dead, set inside the runner so they can't be dropped:

```
node <runner> test/operations.test.js test/openapi-coverage.test.js test/admin-action-sweep.test.js test/stack-free-npm-test.test.js
```

`test/operations.test.js` also runs `test/operations/lifecycle/status.test.js`. Run on its own (`node test/operations.test.js`), it exits 0 or 1.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-08 on branch `A10.1-operation-declaration-router` at `f0ba46ffb` (story and ADR commits, before any implementation), screened first for `docker exec`, `TAPESTRY_PORT`, `strfry/publish` and `nak` (none):

```
RESULT operations.test.js pass=1 fail=42 skipped=0
  17 the harness could not run: src/operations/catalog/lifecycle/status.js does not exist yet (ADR graph-operations-foundation/0001)
   6 src/operations/index.js does not exist yet (ADR graph-operations-foundation/0001 Decision 1)
   6 src/operations/catalog/lifecycle/status.js does not exist yet (ADR graph-operations-foundation/0001 Decision 11)
   4 src/operations/openapi.js does not exist yet (ADR Decision 6)
   3 bin/tapestry.js does not exist yet (ADR Decision 7)
   2 src/operations/routeTable.js does not exist yet (ADR Decision 3)
   1 src/operations/catalog/lifecycle/status.js does not exist yet (ADR Decision 11)
   1 src/api/firmware/index.js must export readInstallState; it is undefined
   1 register(app) must register GET /api/tapestry/lifecycle/status
   1 bin/control-panel.js must build openapiSpec as withOperationDocs(yaml.load(…openapi.yaml…)) (ADR Decision 6)
  (the one pass is T1, the discovery of test/operations/ suites, which is the suite's own machinery)

RESULT openapi-coverage.test.js pass=7 fail=6 skipped=0
  C2, C3, C4, C5, V1: src/operations/openapi.js does not exist yet: the served document is the YAML plus the
                      operations' generated entries (ADR graph-operations-foundation/0001 Decision 6)
  D2: the unchanged copy must pass the suite before the demo means anything (the same cause, in the copy)

RESULT admin-action-sweep.test.js pass=9 fail=0 skipped=0      (unchanged; it must still pass after Implementation)
RESULT stack-free-npm-test.test.js pass=6 fail=0 skipped=1     (G5: the new suite is registered; test/operations/ isn't scanned)
```
