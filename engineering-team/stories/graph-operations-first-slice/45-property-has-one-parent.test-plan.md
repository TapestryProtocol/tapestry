# Test Plan: Story 45 — a property hangs under one parent: `rules check`, `rules repair`, and the old routes

**Story:** `engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0045-property-has-one-parent.md` (with Amendment 1)
**Date:** 2026-11-20

## Coverage map

Five suites, all stack-free, all under `test/operations/rules/`, so `test/operations.test.js` finds and runs them with no line in `test/registry.js`.

| Criterion | Tests | Test file | Level |
|---|---|---|---|
| AC1 — the rule | PH1 (the loader finds it: refuses false, no refusals, `violations` and `scan`), PH3, PH8, PH9 (rulebook entry 11), PH10 (firmware's item, the generator's check) | `property-has-one-parent.test.js` | unit, over the fake |
| AC2 — `rules check` reports it | PH2, PH5, PH7 (the rule's scan and findings); CK1 (the whole graph: the eleven findings), CK2 (a finding's shape), CK3 (ids), CK4 (concept and node scopes), CK7 (paging), CK8 (changes nothing) | `property-has-one-parent.test.js`, `check.test.js` | unit; operation, through the real catalog over the fake |
| AC3 — `rules repair` takes off the extra link | PH4 (the fix plans); RP1 (the graph after is the graph before less one relationship, plus one entry), RP2 (the answer and the change entry), RP3 (history by property, schema, concept), RP4 (tangled-tree before, update-property after), RP5 (the repeat), RP6 (the lock first) | `property-has-one-parent.test.js`, `repair.test.js` | operation |
| AC4 — the choices left | PH6 (every other finding: no fix, a choice, the way on); RP9 (left, changing nothing), RP10 (a scope repair fixes the own, leaves the rest, in one answer) | `property-has-one-parent.test.js`, `repair.test.js` | unit; operation |
| AC5 — the refusals | CK5 (`unknown-rule`, `not-checkable`), CK6 (`unknown-node`, `missing-input`); RP7 (`changed-since-check`), RP8 (`firmware-concept` without the override; repaired with it), RP13 (`bad-target`, `unknown-violation`, `unknown-rule`, `not-checkable`, `unknown-node`, each changing nothing) | `check.test.js`, `repair.test.js` | operation |
| AC6 — the old enumerate route | OR1 (no link to a schema, written or signed; `schemaWired` false), OR2 (a created property hangs under the primary property, its address from it), OR3 (no primary property: refused before anything is signed), OR9 (an address another node holds: refused before anything is signed; Amendment 2) | `old-routes-hang-properties-under-the-primary-property.test.js` | the real handler, in a child over the fake |
| AC7 — the old create-property route | OR4 (no parent: under the primary property), OR5 (a parent: its address from it), OR6 (one name on two concepts is two nodes), OR7 (no primary property: refused), OR8 (an address another node holds: refused, naming it; Amendment 2) | same | the real handler, in a child over the fake |
| AC8 — it lasts, and reaches agents | CK9 and RP14 (401, 403, 415; an admin's repair is the admin's; nothing signed), CK10 and RP16 (listed, /docs), CK11 and RP15 (the internal command), RP11 and RP12 (scope repairs, the lock order, the cap of 100), XR1 (an admin agent through the external CLI); the live checks L1–L4 below (restore, reinstall, real Neo4j) | `check.test.js`, `repair.test.js`, `rules-agent-through-cli.test.js` | operation; external CLI; live |

ADR decisions without their own criterion: Decision 2 (`scan`) is PH2 and PH7; Decision 3 (a finding's id) is CK3 and RP7; Decision 7 (the policy) is RP8, RP9 and RP10; Decision 8 (the cap) is RP12; Decision 10 (what a repair leaves) is RP1; Decision 13 (the docs) is PH9 to PH11; Amendment 1 is PH6, CK2 and RP9.

## Test Design amendment (found in Implementation, 2026-11-20)

Two existing suites pin the rulebook's list of rules, so a new rule has to be added to them, as story 19's test commit did for rule 10:
- `test/graph-rules-builder.test.js`: GB2's ten entries, and the `REAL` list behind GB2 to GB6;
- `test/graph-rule-firmware.test.js`: GF9's `RULES`.

This plan missed them. The scoped gate caught them, failing GB2, GB6 and GF9 once rule 11 was in the rulebook. Each now lists `property-has-one-parent` as rule 11, with ADR 0045 as its source. The change is its own test commit, ahead of the implementation's. Both suites then pass: 26, and 13 with 4 live skips.

## The seed

`test/helpers/propertyParentsGraph.js` (new) builds on `test/helpers/enumerationGraph.js`'s `prepareEnumeration`, which already holds grok bot's project hung on its schema too (the live case) and hut's door under two properties. It adds one case for each kind of finding: two fixable in the instance's own concepts (grok bot's project; bot's team.lead, nested), one in firmware's (word's spelling), two in concepts that aren't the instance's own (nostr relay's motto, another author's; recipe's dish, the owner's own key's), a node two concepts' trees share, a property hung only on a schema, one hung on an element, one under its tree and another concept's schema, a misplaced primary property, and an unhooked property (never judged). It also adds the relationship element today's enumerate route signs for grok bot's link.

The seed checks itself. `oddProperties(state)` restates the rule in plain JavaScript over the fake's state, and the seed throws unless the nodes it finds are exactly the eleven cases. So when a test fails on a finding, the fault is in the rule, not in the seed.

## Edge cases

- [x] Scope that names no node, a change entry or a tag (CK6); no scope (CK6).
- [x] A node that isn't a property, as a scope or an item (CK4, PH7, PH8).
- [x] A property under no parent: never judged (PH2, PH8, CK4).
- [x] A stale id, after the node's parents change (RP7); an id that doesn't parse (RP13).
- [x] The repeat (RP5, XR1) and a scope repair where findings remain but none may be fixed (RP10).
- [x] More than 100 fixable findings (RP12).
- [x] Two concepts in one scope repair: their headers locked in tapestryKey order before any delete (RP11).
- [x] A cursor from another scope (CK7).
- [ ] The re-judge after the writes (Decision 6, step 9) rolling a repair back: no input reaches it once steps 5 to 8 are right, so no test drives it. The Reviewer reads it.
- [ ] Two repairs of one concept at once: the lock is pinned by RP6 and RP11, as EN14 pins enumerate's. The live check doesn't race them.
- [ ] The repair's own guard against another author's concept (Decision 7, Amendment 1): the rule plans no fix there, so no input reaches the guard, and RP9 passes through the rule. The Reviewer reads it.
- [x] A name that slugs like a property already under the parent, on each old route (OR8, OR9; review round 1, Amendment 2).

## Test infrastructure

- **Runner:** Node's built-in runner through each suite's `run()`, as every suite under `test/operations/` has one. A run's record is read with `npm run gate:status`.
- **The graph:** `test/helpers/graphFake.js` and `test/helpers/pathCypherFake.js`, through `test/helpers/operationsHarness.js` (operations) and `test/helpers/externalCliServer.js` (the agent). The fake runs a subset of Cypher: MATCH, OPTIONAL MATCH, UNWIND, WITH, variable-length paths, `count` and `collect`, but no map literals, path variables or arithmetic. The rule's and the operations' statements must stay within it, or a suite fails with "the fake graph can't run this Cypher", naming what it met.
- **The old routes:** `test/helpers/saveSchemaChild.js` runs the real normalize handlers in a child process, with the database driver, the assistant's key, the store and `strfry import` stubbed. Two changes to it here:
  - a `route` kind, which calls any route `registerNormalizeRoutes` registers;
  - `IS_THE_PROPERTY_TREE_GRAPH_FOR` added to the types its fake reads, since create-property reads a concept's property tree graph after it signs.

  `schema-save-finds-the-right-header.test.js`, its other user, still passes (26 passed, 2 skipped, both live).
- **No stack.** The local container is the agent-memory instance, so nothing here reaches it. Run each suite with every endpoint on a dead port, `TAPESTRY_CONTAINER=no-such-container`, and stub `curl` and `docker` first on `PATH`.
- **Firmware state:** none for the stack-free suites. L3 below runs a firmware install on the scratch stack.

## How to run

One suite at a time, from the checkout, with the scoped gate's environment (dead endpoints, `TAPESTRY_CONTAINER=no-such-container`, stub `curl` and `docker` first on `PATH`):

```
node test/operations/rules/property-has-one-parent.test.js
node test/operations/rules/check.test.js
node test/operations/rules/repair.test.js
node test/operations/rules/old-routes-hang-properties-under-the-primary-property.test.js
node test/operations/rules/rules-agent-through-cli.test.js
```

For the review's gate record, run these through the gate engine with an explicit list: CI's own entries for an operations change, `operations.test.js` (which runs every suite under `test/operations/`), `external-cli.test.js`, `openapi-coverage.test.js`, `admin-action-sweep.test.js` and `schema-save-finds-the-right-header.test.js`; and the two rulebook suites the Test Design amendment changed, `graph-rules-builder.test.js` and `graph-rule-firmware.test.js`. List `operations.test.js` or its suites, never both. Never run the full `npm test` on this Mac. CI runs it on the pull request.

## Live checks (Implementation and Review, on a scratch stack)

AC8's lasting and real-Neo4j parts, which the fake can't show. Each runs on a scratch stack made for the purpose, never on the local agent-memory instance. Leave `TAPESTRY_CONTAINER_PORT` unset.

- **L1 — the agent, on real Neo4j.**
  1. Make a concept and a field through the external CLI as an admin.
  2. Hang the field on its concept's schema node with one `MERGE` through `cypher-shell` inside the scratch container. That is setup; no operation makes the tangle.
  3. Run XR1's steps: `rules check`, `rules repair`, `rules check`, `graph update-property`, and the repair again.
- **L2 — a restore.** `lifecycle backup`, then `lifecycle restore` of it on a fresh scratch instance; `rules check --scope graph` there finds nothing for the repaired field (BIBLE §30).
- **L3 — a reinstall.** `POST /api/firmware/install` on the scratch stack. Afterwards:
  - `rules check --scope graph` still finds nothing for the field: the removed link hasn't come back (ADR Context 10);
  - the graph rule concept holds an item for `property-has-one-parent`.
- **L4 — the old routes, on real Neo4j.**
  1. `POST /api/normalize/enumerate` with `createProperty` on a concept.
  2. `POST /api/normalize/create-property` with no parent, on two concepts with the same name.
  3. `rules check --scope graph` finds none of the properties they made.

AC8's last sentence, Zeus repairing grok bot on david.tapestry.ninja, happens after the change reaches that instance, on the owner's yes. It isn't part of this gate.

## Verification

The new tests fail with the current code, each for the right reason. Confirmed on 2026-11-20 at commit `c586fc2f` (the ADR), with this plan's suites and helpers uncommitted on top:

```
operations: rule property-has-one-parent: 0 passed, 11 failed, 0 skipped
  PH1–PH8   rule property-has-one-parent isn't loaded: src/operations/rules/property-has-one-parent.js does not exist yet (ADR graph-operations-first-slice/0045 Decision 1)
  PH9       docs/GRAPH_RULES.md has no entry "## 11. `property-has-one-parent`" yet (ADR graph-operations-first-slice/0045 Decision 13)
  PH10      firmware's element for the rule exists: firmware/versions/v1.0.0/concepts/graph-rule/elements/property-has-one-parent.json (node src/firmware/graph-rules.js writes it; ADR 0045 Decision 13)
  PH11      the catalog's §4 check row names property-has-one-parent; got "| `check` | Run the rules over a node, a concept or the whole graph | … | Partial: the 11 checks under `/api/audit/` cover some of the rules. |"

operations: rules check: 0 passed, 11 failed, 0 skipped
  CK1–CK10  src/operations/catalog/rules/check.js does not exist yet (ADR graph-operations-first-slice/0045 Decision 5): GET /api/tapestry/rules/check answered 404
  CK11      src/operations/catalog/rules/check.js does not exist yet (ADR 0045 Decision 5): the command exited 2

operations: rules repair: 0 passed, 16 failed, 0 skipped
  RP1–RP10, RP13–RP16  rules check, which gives a finding's id, does not exist yet: src/operations/catalog/rules/check.js (ADR 0045 Decision 5): it answered 404
  RP11, RP12           src/operations/catalog/rules/repair.js does not exist yet (ADR graph-operations-first-slice/0045 Decision 6): POST /api/tapestry/rules/repair answered 404

operations: the old enumerate and create-property routes hang a property under its primary property: 0 passed, 7 failed, 0 skipped
  OR1  no IS_A_PROPERTY_OF to a JSON schema node is written; got [{"cypher":"… MERGE (a)-[:IS_A_PROPERTY_OF]->(b)","params":{"from":"39999:<TA>:project-101c40ed","to":"39999:<TA>:grok-bot-schema"}}]
  OR2  the new property's d-tag comes from grok bot's primary property (sponsor-101c40ed); got ["sponsor-6d675dda"]
  OR3  refused, naming kiosk and POST /api/normalize/skeleton; got {"statusCode":200,"body":{"success":true,"message":"project ENUMERATES stall",…,"schemaWired":true}}
  OR4  its address comes from grok bot's primary property, its target; got {"name":"model","uuid":"39999:<TA>:model-6d675dda",…,"targetUuid":"39999:<TA>:grok-bot-schema",…}
  OR5  its address comes from project, its parent (39999:<TA>:url-044b3c2e); got {"statusCode":200,"body":{"success":true,…,"property":{"name":"url","uuid":"39999:<TA>:url-6d675dda",…
  OR6  two addresses, so two nodes; got 39999:<TA>:model-6d675dda and 39999:<TA>:model-6d675dda
  OR7  refused, naming kiosk and POST /api/normalize/skeleton; got {"statusCode":200,"body":{"success":true,"message":"Property \\"stall\\" created and wired to \\"JSON schema for the concept of kiosks\\".",…

operations: an admin agent repairs a property hung under two parents through the external CLI: 0 passed, 1 failed, 0 skipped
  XR1  src/operations/catalog/rules/check.js does not exist yet (ADR graph-operations-first-slice/0045 Decision 5): the external CLI exited 2: 'rules check' isn't among the operations … may call
       (its setup passed first: the agent's create-concept and add-property, and update-property refused tangled-tree once the field was hung on the schema too)
```

OR1 to OR7 show today's bugs themselves. The enumerate route hangs grok bot's project on the schema. It, and create-property, take their addresses from the `property` concept (`-6d675dda` everywhere), and so give one name on two concepts one node.
