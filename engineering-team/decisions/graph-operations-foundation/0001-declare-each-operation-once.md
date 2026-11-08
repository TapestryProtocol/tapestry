# ADR 0001: Declare each operation once — the operations module behind `/api/tapestry/`, its command and its `/docs` entries

**Status:** Accepted
**Date:** 2026-11-08
**Story:** `engineering-team/stories/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md`

## Context

The story (Loom A10.1) asks for the base every graph operation is built on, proved with the first one. Its criteria, in short:

- **AC1** `GET /api/tapestry/lifecycle/status` answers the owner or an admin with four parts — backup (none recorded yet), firmware (the version carried, and all, some or none of its concepts in the graph), migrations (none recorded yet), cache (how many nodes have a cached Tapestry JSON and how many don't) — and changes nothing.
- **AC2** Under `/api/tapestry/`: 401 for a caller not signed in, 403 for a signed-in person who is neither the owner nor an admin, direct-local callers let through; a declaration that tries to open an operation to visitors or to ordinary signed-in people leaves them refused and is reported invalid.
- **AC3** `tapestry lifecycle status`, in a shell inside the container, prints what the route returns, with no sign-in; `tapestry` alone lists the operations by group; an unknown group or operation is refused with a list of what exists.
- **AC4** `/docs` shows the operation under its group, with its description, who may call it, inputs, result and refusals, all from its declaration; the coverage gate passes with no known-gaps line for it.
- **AC5** An undeclared, missing or ill-typed input is refused with 400 naming it, by the route and by the command alike, before the operation runs.
- **AC6** A new operation declared in files of its own, with no other file changed, gets its route, its command and its `/docs` entry, and the route-table checks and the coverage gate still pass. A test shows it.
- **AC7** The owner or an admin can ask the instance for every operation they may call, with the facts `/docs` shows, machine-readable.

**Orientation.** The story changes no concept, and this design was written without a dev stack (AGENTS.md §2's stack-absent branch), so the concept graph was not consulted. No concept handle is cited here.

**What binds the design.**

- **The design doc** ([docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md)):
  - D1 fixes the command groups by role: graph, raw, rules, import, export, cache, lifecycle.
  - D13 puts the routes at `/api/tapestry/<group>/<operation>`.
  - §2 says the routes and the internal CLI call one operations module in-process, and the internal CLI needs no sign-in (the trust today's in-container calls get).
  - The catalog's conventions: reads are `GET`, writes `POST`, and the command is `tapestry <group> <operation>`.
- **The planning gate's answers** (story, "Open questions"): admins may call `lifecycle status`, and agents get the list of operations (AC7).

**Facts from the code.**

1. **Routes.** `register(app)` in `src/api/index.js` (`:102`) registers every module's routes. The route walker (`test/helpers/routeWalk.js`) loads exactly that function into a bare Express app, in a child process. Modules register their own routes, as `registerFirmwareApiRoutes(app)` does at `:478–480`.
2. **The central access check.** `authMiddleware` (`src/middleware/auth.js:340–406`) handles every `/api/` request:
   - It trusts direct-local callers first (`:363–371`, `req.localTrusted`).
   - Then the route table decides (`:386–405`). Refusals are `{ success: false, error }`, and the message names who may act: 401 "Sign in as the owner or an admin to do this.", 403 "Only the owner or an admin can do this.", and "Only the owner can do this." for `owner-only`.
3. **The route table.** `src/middleware/routeAccess.js` must cover every registered route, keyed exactly as registered (`:5–30`).
   - When several entries match, the strictest access wins, and a path no entry matches resolves to `owner` (`:519–524`).
   - `owner-only` exists, but no route uses it yet: admins equal the owner by default (ADR `security-auth-exposure/0005`, Decision 4, and the owner's answers at its gate).
   - The sweep `test/admin-action-sweep.test.js` fails a registered route with no matching entry (AC6a, `:117–142`) and an entry that matches no registered route (T2, `:160–176`).
4. **`/docs`.** `bin/control-panel.js:315–320` loads `src/api/openapi.yaml` once and serves it before the auth middleware.
   - The coverage gate `test/openapi-coverage.test.js` reads the YAML text (`documentedPairs`, `:91–98`). It fails on a registered `/api/` route that is neither documented nor on `test/fixtures/openapi-known-gaps.json` (C2), and on a documented route that isn't registered (C4).
   - Its D2 test already runs the suite in a throwaway copy of the tree (`throwawayCopy`, `runSuiteIn`).
5. **Test registry.** `test/registry.js` must list every top-level `test/*.test.js`. G5 (`test/stack-free-npm-test.test.js:194–203`) reads only the top-level folder.
6. **No command is on PATH in the image.** `Dockerfile:85–97` installs dependencies in place, and nothing links `package.json`'s bins.
   - The control panel runs as root with `HOME=/root` (`docker/supervisord.conf:55–62`), as `docker exec` does, so an in-container command opens the same LMDB (`src/lib/tapestry-store.js:27–28`).
   - `getConfigFromFile` (`src/utils/config.js:17–44`) reads `/etc/brainstorm.conf` before the environment, so the command gets the live Neo4j password. But it logs every lookup with `console.log`, and so does the LMDB store when it opens.
7. **What `lifecycle status` can read today.**
   - **Firmware.** `readInstallState()` (`src/api/firmware/index.js:128–152`, not exported) checks each manifest concept's header `39998:<TA>:<slug>`, with the TA resolved at runtime. Nothing records which version was installed. Only the active firmware's version is known: `firmware/active` → `versions/v1.0.0`, manifest `"1.0.0"`.
   - **Cache.** The handler of `GET /api/tapestry-key/status` (`src/api/tapestry-key/index.js:35–88`) counts the nodes with and without a tapestryKey, and looks each key up in the LMDB: derived, empty or missing. That is the honest measure. The Neo4j marker `tapestryJsonUpdatedAt`, which `derive-status` counts (`:425–456`), stays set when the LMDB is lost with the container (BIBLE §29).
   - **Backup.** Nothing backs up the graph. `bin/backup.js` copies configuration, keys and logs.
   - **Migrations.** Nothing records a migration.
8. **ajv 8** is a dependency, used as `new Ajv({ allErrors: true, strict: false })` (`src/api/audit/index.js:21–22`, `src/lib/derivers/word.js:159–160`).

## Options considered

### Option A — A catalog folder of declaration files, and one registry that generates every surface

Each operation is one file, `src/operations/catalog/<group>/<name>.js`, exporting a plain declaration object with a `run` function. A loader finds them by reading the folder, so nothing lists them by hand. From the loaded declarations, one module derives everything else:

- the Express routes;
- the route table's entries;
- the `/docs` paths;
- the command's dispatch and help;
- the list of operations.

The shared files learn about the module once, in this story, and never about an individual operation.

- **Pros.** A new operation is one new file (plus its own test file, Decision 12), so builders working in parallel never meet in a shared file. Every surface is generated from the same object, so they cannot disagree. The route table still keys every route exactly, which keeps the sweep, the strictest-wins rule and `owner-only` working unchanged.
- **Cons.** The route table, the entrypoint's document and the coverage gate each gain a dependency on the loader. A declaration error is found when the folder is loaded, not when the file is written (Decision 9 catches it in the gate).

### Option B — One hand-kept list of operations

An `operations/index.js` (or a JSON manifest) names every operation, its file and its access. The routes, the docs and the command read the list.

- **Pros.** Simplest discovery, and every operation is visible in one place.
- **Cons.** Every new operation edits the same list, which is exactly the shared-file collision the story exists to prevent (AC6 forbids it). Builders adding at the end of one array is the classic merge conflict.

### Option C — One dispatch route per method, resolving the operation at request time

Register `GET` and `POST /api/tapestry/:group/:operation` once. The handler looks the declaration up, checks the caller and runs it. The command and the docs are generated separately.

- **Pros.** Two registered routes and two table entries, written by hand once, and no generated table entries. Unknown operations get a JSON 404 for free.
- **Cons.**
  - The coverage gate would see one parametric route (`GET /api/tapestry/{}/{}`) that no documented path matches, while the documented `GET /api/tapestry/lifecycle/status` would match no registered route: C2 and C4 both fail, unless the gate is weakened for the prefix.
  - The table could only say `owner` for the whole prefix, so an owner-only operation would be enforced in the handler while the table understated it. ADR `security-auth-exposure/0005` wants a route-wide owner-only decision to be in the table.
  - The route walk could no longer show which operations exist.

## Decision

We chose **Option A**, because it is the only one of the three that meets AC6 without weakening the route table or the coverage gate. The rest of this section says exactly how.

**1. Layout.** One module, `src/operations/`:

| File | What it does |
|---|---|
| `index.js` | the loader and registry: `loadOperations({ dir })`, `findOperation(group, name)`, `callOperation(op, rawInputs, context, { source })` |
| `declaration.js` | the rules a declaration must meet |
| `groups.js` | the allowed groups, each with its one-line description |
| `inputs.js` | input checking |
| `refusal.js` | the `refusal(code, message)` helper an operation throws |
| `routeTable.js` | the route-table entries |
| `http.js` | the Express routes |
| `openapi.js` | the `/docs` paths |
| `cli.js` | the command |
| `catalog/<group>/<name>.js` | one declaration per operation |

- **What the loader picks up.** Only files whose name matches `^[a-z][a-z0-9]*(-[a-z0-9]+)*\.js$` in a group folder are declarations. Anything else beside them (`status.parts.js`, `_shared.js`, a README) is the operation's own helper file and is ignored.
- **The path must agree with the declaration.** The file's group folder and name must equal the declaration's `group` and `name`.
- **Allowed groups.** They are D1's groups except `raw`: graph, rules, import, export, cache, lifecycle. `raw` is refused for now, because the catalog makes it owner-only and command-only (catalog §3), and how a declaration says "no route" is that group's first task's to decide. A new group is a design change, made in `groups.js`.
- **Caching.** `loadOperations` reads the folder once per `dir` and caches the result. Its default `dir` is `src/operations/catalog`.

**2. The declaration.** A plain object:

```js
module.exports = {
  group: 'lifecycle',              // must equal the folder
  name: 'status',                  // must equal the file name
  kind: 'read',                    // 'read' → GET, 'write' → POST
  access: 'owner-and-admins',      // or 'owner-only'
  summary: 'One line',
  description: 'Markdown, for /docs and the list',
  inputs: {                        // may be empty
    limit: { schema: { type: 'integer', minimum: 1, maximum: 500, default: 50 }, required: false, description: '…' },
  },
  result: { description: '…', schema: { /* JSON Schema of `data` */ } },
  refusals: [{ code: 'not-found', status: 404, when: '…' }],   // the operation's own; may be empty
  async run(inputs, context) { /* returns `data` */ },
};
```

- **Rules the loader enforces:**
  - `group`, `name`, `kind`, `access`, `summary`, `result` and `run` are required.
  - `inputs` and `refusals` default to empty.
  - Every schema compiles with ajv.
  - Refusal codes are kebab-case, statuses are 4xx, and no declared code repeats a built-in one (Decision 4).
  - Other fields are allowed and ignored by the generators: a missing required field already fails, and an operation may keep its own helpers on its export (Decision 11).
- **The schema subset.** Schemas use what OpenAPI 3.0 and ajv share: one `type`, `nullable`, `enum`, `properties`, `required`, `items`, `additionalProperties`, the numeric and length bounds, `pattern`, `default` and `description`.
- **What `run` gets.** It receives the checked inputs (defaults applied) and `context = { via: 'http' | 'cli', caller: { role: 'owner' | 'admin' | 'local', pubkey } }`. It returns the result's `data`. To refuse, it throws `refusal(code, message)` with a code it declared.

**3. Who may call.**

- **Two access values.** A declaration says `owner-and-admins` or `owner-only`. There is no value that opens an operation to visitors or to ordinary signed-in people. Any other value makes the declaration invalid (Decision 9), so its route is never registered, and those callers are refused, as AC2 asks.
- **The route table.** `routeTable.routeAccessEntries()` gives every valid operation an exact entry, keyed `"<METHOD> /api/tapestry/<group>/<name>"`: `{ access: 'owner', kind: 'read' }` for `owner-and-admins`, `{ access: 'owner-only', … }` for `owner-only`, with kind `action` for writes. `src/middleware/routeAccess.js` spreads them into `ROUTE_ACCESS`, so the central check enforces both levels, the table stays total, and the sweep sees an exact key for each route. Even if an entry went missing, the default for an unmatched path is `owner`.
- **The router re-checks.** The handler checks the declaration's access against the caller before anything else: direct-local, then the owner's pubkey, then `isOwnerOrAdmin`. It answers with the central check's 401 and 403 messages, and adds `code: 'sign-in-required' | 'not-allowed'`. The central check normally answers first. The re-check keeps the module safe on its own, in a test app or behind any other middleware, as the tagging-edges handlers re-check theirs.
- **The command** is local trust: its caller is `{ role: 'local' }`, and it may run every operation, `owner-only` ones included (design §2).
- **Sign-in is the instance's existing signed-challenge handshake** (ADR `security-auth-exposure/0003`). Agents use `POST /api/auth/verify-user` then `POST /api/auth/login-user`, and an admin's key is admitted through the admin list. Nothing new is built.

**4. HTTP.**

- **Routes.** `http.registerOperationRoutes(app)` registers each valid operation at `/api/tapestry/<group>/<name>`: `GET` for reads, with inputs from the query string, and `POST` for writes, with inputs from the JSON body (the other source is ignored). It also registers `GET /api/tapestry/operations` (Decision 8). Problems found while loading are logged, one `console.warn` line each.
- **Success** is `200 { success: true, data }`.
- **Refusals** are `{ success: false, error, code, input? }`:

| Status | Code | When |
|---|---|---|
| 400 | `unknown-input` | an input the declaration doesn't name (`input`); applies to every operation, even one with no inputs |
| 400 | `missing-input` | a required input left out (`input`) |
| 400 | `invalid-input` | an input of the wrong type or out of range (`input`) |
| 400 | `invalid-body` | a write's body that isn't a JSON object |
| 401 / 403 | `sign-in-required` / `not-allowed` | from the re-check |
| declared | declared | a refusal the operation throws, at its declared status |
| 500 | `failed` | anything else, with `error: "<group> <name> failed: <message>"` |

- **Undeclared refusals.** A refusal thrown with a code the operation didn't declare becomes a 500, so a declaration never under-documents its refusals.
- **Unknown paths.** An unknown path under the prefix falls through to Express's 404, as any unknown `/api/` path does today. The list (Decision 8) is how a caller learns what exists.

**5. Inputs.**

- **Validation.** `inputs.js` builds one object schema per operation, `{ type: 'object', properties, required, additionalProperties: false }`, and checks it with ajv: `allErrors: true`, `strict: false`, `useDefaults: true`.
- **Two checkers.** Query-string and command inputs, which arrive as text, get `coerceTypes: 'array'` (`"5"` → 5, `"true"` → true, one value → a one-item list). JSON bodies get no coercion, since a typed caller sends types.
- **Which error is named.** Errors map to the first refusal in the order unknown, missing, invalid, naming the input. The checkers validate a copy of the input object, because coercion and defaults change it in place.

**6. `/docs`.**

- **The served document.** `openapi.withOperationDocs(spec)` returns a copy of the loaded YAML with, for each valid operation, its path entry and one tag per group (`Tapestry: <group>`, described from `groups.js`), plus the list route's entry. `bin/control-panel.js` serves `withOperationDocs(yaml.load(…))`, so the served document is the YAML plus the generated entries. It throws if the YAML already documents a generated path, so no operation has two sources.
- **What an entry holds.**
  - Its tag and summary.
  - A description: the declaration's, then "**Who may call:** the owner and admins" (or "the owner only") with "and direct-local callers; 401 when not signed in, 403 for anyone else", then "**Command:** `tapestry <group> <name>`".
  - `operationId` `tapestry-<group>-<name>`.
  - Query `parameters` for a read, or a JSON `requestBody` for a write.
  - Responses: 200 with `{ success, data: <result.schema> }`, 400 with the refusal schema, 401, 403, each declared refusal's status, and 500.
- **The coverage gate** reads the served document instead of the YAML text alone. That re-aim is the Tester's (Implementation notes).

**7. The command.**

- **Where it lives.** `bin/tapestry.js` (`#!/usr/bin/env node`) calls `cli.main(argv, io)`, which returns an exit code. The Dockerfile links it onto PATH as `tapestry`.
- **Usage:**
  - `tapestry`, `tapestry help` or `tapestry --help` lists the operations by group, each with its summary. Load problems go to stderr.
  - `tapestry <group>` lists one group.
  - `tapestry <group> <name> --help` shows the operation's inputs, result, refusals, who may call it and its route.
  - `tapestry <group> <name> [--input value …]` runs it.
- **Flags.** `--name value` or `--name=value`. A flag with no value is `true`. A repeated flag makes a list. Unknown flags are the same `unknown-input` refusal the route gives, and all inputs go through the coercing checker. Stray positional words are a usage error.
- **Output and exit codes.** It prints, on stdout, the JSON body the route would send, success or refusal, indented two spaces. The exit code is 0 for success, 1 for a refusal, 2 for usage (an unknown group or operation, with a message listing what exists), and 3 for a failure.
- **Keeping stdout clean.** During a run, `console.log`, `info` and `debug` go to stderr, so stdout carries only the answer: `getConfigFromFile` and the LMDB store log as they work.
- **Exiting.** `bin/tapestry.js` exits in stdout's write callback, so piped output is never cut off.

**8. The list of operations.**

- **The route.** `GET /api/tapestry/operations` answers `{ success: true, data: { operations, problems } }`.
- **What each operation carries:** `group`, `name`, `summary`, `description`, `kind`, `access`, `method`, `route`, `command`, `inputs` (each `{ schema, required, description }`), `result` (`{ description, schema }`) and `refusals` (the built-in ones it can return, then its own, each `{ code, status, when }`). These are the facts `/docs` shows.
- **Filtered by caller.** An admin sees the `owner-and-admins` operations; the owner and direct-local callers see all of them.
- **`problems`** lists each invalid declaration: its file, and what's wrong with it.
- **Access.** Its table entry is written once in `routeAccess.js` (`'GET /api/tapestry/operations': OWNER_READ`). The router applies the same re-check. Its `/docs` entry is generated with the rest.

**9. Invalid declarations.** The loader returns `{ operations, problems }`, and an invalid declaration is left out of every surface. One bad file never stops the control panel starting. Its problem is reported in the startup log, on the command's stderr and in the list's `problems`. A test in the gate requires the real catalog to load with no problems, so a bad declaration fails CI.

**10. Loading has no side effects.** The route table, the entrypoint and the gate load the catalog, so a declaration file requires nothing at load time that opens a connection or a file. Its `run` requires the Neo4j driver, the LMDB store or an API module lazily.

**11. `lifecycle status`** — `catalog/lifecycle/status.js`: a read, `owner-and-admins`, no inputs, no refusals of its own.

- **Four readers.** It keeps its four part-readers on its export, `parts.backup`, `parts.firmware`, `parts.migrations` and `parts.cache`. `run` calls them through that object, all at once, with `Promise.allSettled`, so a suite can replace one.
- **A part that fails** answers `{ known: false, problem }`, and the operation still succeeds. Status reports what it can when Neo4j is down.
- **No timestamps**, so asking twice with the graph unchanged gives the same answer (AC1).

| Part | Answer |
|---|---|
| `backup` | `{ known: true, last: null, note }`. The note says no backup of the graph has been recorded. |
| `firmware` | `{ known: true, version, installed: 'all' \| 'some' \| 'none', conceptsInGraph, concepts, missing }`, from `readInstallState()`, newly exported from `src/api/firmware/index.js`. |
| `migrations` | `{ known: true, applied: [], note }`. |
| `cache` | `{ known: true, nodes, withTapestryKey, withoutTapestryKey, cached, cachedEmpty, notCached }`, from a `readTapestryKeyCounts()` extracted from `GET /api/tapestry-key/status`'s handler, which keeps its response byte for byte. `nodes` is that route's scope: nodes with a `uuid` or an `id`. The schema's description says so. |

**12. Each operation's tests are its own files.** An operation's suite is `test/operations/<group>/<name>.test.js` and exports `run()`, like any suite. One registered suite discovers them and runs them, and fails on a file there that exports no `run`. G5 reads only the top-level folder, so a new operation never edits `test/registry.js`. That one discovering suite keeps the registry's guarantee that no suite is silently never run.

## Consequences

**What this enables**

- A teammate adds an operation with two new files, its declaration and its suite. Its route, table entry, `/docs` entry, command and list entry follow from them.
- Agents can read the list and call operations the day they land, which is what A10.6's external CLI needs.
- Access can only be narrowed: there is no value for visitors.

**What this constrains**

- The route table, the entrypoint and the coverage gate now load the operations catalog. A slow or side-effecting declaration file would slow or break all three, which is why Decision 10 is a rule.
- Declarations must use the OpenAPI 3.0 / ajv schema subset.
- The shared files changed in this story — `src/api/index.js`, `src/middleware/routeAccess.js`, `bin/control-panel.js`, `Dockerfile` and the two exports — are not edited by later operations. Later foundation tasks may extend the module itself. A10.4, for one, will add the write path's fields (guards, the key that makes a write safe to repeat, the change entry) to the declaration and to `declaration.js`.

**New debt and follow-ups**

- **Layering.** `lifecycle status` reads through two API modules (`src/api/firmware`, `src/api/tapestry-key`). When `cache check` and the cache group land, those readers move into the operations module and the old routes call them.
- **A10.2 and A10.3 fill in status's `backup` and `migrations` parts,** editing `status.js` itself. It's lifecycle's own file, but two tasks touch it, so they should land one after the other.
- **The command needs an image rebuild to appear on PATH.** The Dockerfile link takes effect when an image is built: every deploy does that, but a long-running local container needs a rebuild. The Dockerfile is a runtime path, so merging to staging also rolls the brain images.
- **Cost.** Status's cache count reads every key once, linear in keyed nodes (the same cost `GET /api/tapestry-key/status` already has). `cache check` can make it cheaper.
- **The `raw` group** stays refused until its first task decides how a command-only operation is declared.
- **BIBLE §11** should describe the prefix and the declaration rule when the book closes, ratified with the rest (design §8).

**Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

**New files**

- `src/operations/index.js`, `declaration.js`, `groups.js`, `inputs.js`, `refusal.js`, `routeTable.js`, `http.js`, `openapi.js`, `cli.js`, as Decisions 1–9 describe.
- `src/operations/catalog/lifecycle/status.js` (Decision 11).
- `bin/tapestry.js`, committed executable (mode 100755).

**Changed files**

- `src/api/index.js`: right after the firmware API (`:478–480`), add `require('../operations/http').registerOperationRoutes(app);` with a comment naming this ADR.
- `src/middleware/routeAccess.js`: add `'GET /api/tapestry/operations': OWNER_READ` to `ROUTE_ACCESS`, after the `tapestry-key` entries, and spread `...require('../operations/routeTable').routeAccessEntries()` into the frozen literal. The validation loop below it then checks the generated entries too. `routeTable.js` must not require `src/middleware/auth.js`, which requires `routeAccess.js`: keep the access re-check in `http.js`.
- `bin/control-panel.js:317`: `const openapiSpec = require('../src/operations/openapi').withOperationDocs(yaml.load(…));`. No route is registered there, so the coverage gate's E1 still holds.
- `Dockerfile`: after the `COPY . …` layer, add `RUN ln -sf /usr/local/lib/node_modules/brainstorm/bin/tapestry.js /usr/local/bin/tapestry && chmod +x /usr/local/lib/node_modules/brainstorm/bin/tapestry.js`. Don't add a `package.json` bin: nothing links bins in this image, and the entry would imply otherwise.
- `src/api/firmware/index.js`: export `readInstallState` beside `registerFirmwareApiRoutes`.
- `src/api/tapestry-key/index.js`: move `handleStatus`'s counting into an exported `readTapestryKeyCounts()`, returning `{ initialized, uninitialized, total, lmdb: { derived, empty, missing } }`. `handleStatus` answers `{ success: true, data: await readTapestryKeyCounts() }`, with its error path unchanged.

**For the Tester (Phase 3: these test changes are the Tester's, not the Implementer's)**

- **Re-aim** `test/openapi-coverage.test.js` so its documented set comes from the served document, `withOperationDocs(yaml.load(text))`, loaded from the tree under test (the copy, in D2).
- **Add** `test/operations.test.js` to `test/registry.js`. It covers the declaration rules on fixtures, the generators, the access re-check, inputs, the command and the list. It also proves AC6 and discovers `test/operations/**` (Decision 12).
- **Add** `test/operations/lifecycle/status.test.js` for AC1, with status's `parts` replaced, so it is stack-free.
- **The AC6 proof** fits the existing throwaway-copy pattern (`openapi-coverage`'s `throwawayCopy` and `runSuiteIn`). In the copy, add only a demo declaration file or two (a read with an input, and a write), then show:
  - the route walk and the sweep pass;
  - the coverage gate passes;
  - the copy's router answers the demo route;
  - the copy's `bin/tapestry.js` runs it;
  - the copy's served document lists it.
- **Live check.** The real readers (Neo4j, LMDB, the firmware manifest) need one live check: on a scratch stack (`scripts/scratch-stack.sh`), never on a shared or private instance. It's part of Implementation's verification, not a gate suite.

**Branches.** A new feature, for `staging` only. It reaches `main` through the normal promotion, and no long-lived sandbox branch needs a port.

## Out of scope

- The write path: guards, the key that makes a write safe to repeat, change entries and who-changed-what (A10.4). This ADR only leaves room for those fields.
- How a command-only (`raw`) operation is declared.
- The external CLI and the agent's skill (A10.6). The list (Decision 8) is what they will read.
- Read visibility (catalog §10, question 1), and admins who differ from one another (§10, question 3).
- Adding codes to the central middleware's 401 and 403, or a JSON 404 for unknown paths under the prefix.
- Retiring or changing any existing route. `GET /api/tapestry-key/status`'s response stays byte for byte.
- Rate limits, and any UI.
