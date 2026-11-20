# ADR 0045: a property hangs under one parent — the rule, `rules check`, `rules repair`, and two old routes fixed

**Status:** Accepted (the owner, 2026-11-20: Option A, as drafted)
**Date:** 2026-11-20
**Story:** `engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.md`
**Loom:** A10.31.a

## Context

Story 45 asks for one rule, `property-has-one-parent`, with the first two operations of the `rules` group to find and fix what breaks it, and for two old routes to stop breaking it. The criteria, in short:
- **AC1:** the rulebook entry; it only reports; its code is one definition, used by check and repair; firmware's graph rule item follows at the next install.
- **AC2:** `GET /api/tapestry/rules/check` over the whole graph, one concept or one node names each violation, its parents, what each parent is, and the repair or why there is none.
- **AC3:** `POST /api/tapestry/rules/repair` takes off a property's link to its own concept's JSON schema when the property also hangs under one parent in that concept's tree, in one recorded write; a repeat finds nothing to repair.
- **AC4:** every other violation is left as a choice, with the way on.
- **AC5:** the refusals; for repair, a firmware concept's violation without the firmware override. Another author's concept is a choice (open question 2, as the owner changed it at the story gate).
- **AC6, AC7:** `POST /api/normalize/enumerate` and `POST /api/normalize/create-property` stop hanging properties on the schema, and create-property's addresses come from the parent.
- **AC8:** it lasts across a restore and a reinstall, reaches agents, and Zeus repairs grok bot.

What the code holds today (branch `A10.31.a-property-one-parent`, at staging `1abd2889`):

1. **The rule contract.** A rule is one file, `src/operations/rules/<name>.js`, exporting `{ name, summary, refuses, refusals, violations(items, read) }` (`src/operations/rules/index.js:6-15`). The loader checks those five and nothing else (`problemsOf`, `:25-42`). The write path runs a declaration's guards as `rule.violations(guard.items(inputs), tx.read)` and throws the first finding (`src/operations/write.js:46-50`). The rulebook's entries 5 to 10 say "`rules check` (A10.31) will run it over the graph", and the rules index says check "will call it as a check, with a read session and the items it scans" (`rules/index.js:13-14`). Nothing says how a check knows *which* items to scan; that is each rule's own question (story 45, open question 1).
2. **The `rules` group already exists.** `src/operations/groups.js:12` declares it, with its /docs line. Nothing is in `src/operations/catalog/rules/` yet. The loader reads each kebab-case file in a group's folder as one declaration, and every surface (route, route table, /docs, `tapestry <group> <name>`, the operations list, so the external CLI) comes from it (`src/operations/index.js:1-17`).
3. **How a property tree is read.** ADR 0018's `treeOf` reads every `Property` that reaches the primary property by `IS_A_PROPERTY_OF*1..33` (`TREE_KEYS`, `src/operations/catalog/graph/_properties.js:485-487`), each with its parents (`NODES`, `:488-491`), and calls the tree tangled when a node other than the root has a number of parents other than one, or a parent outside the tree (`:573-577`). `conceptOfProperty` finds a property's concept by its chain up to a primary property and on to the header, refusing `tangled-tree` for two (`CONCEPT_OF`, `:497-500`; `:612-618`). `load` refuses a concept that isn't the instance's own (`h.author !== inst.ta`) and a firmware concept (`K.isFirmware(h.uuid)`, `_concepts.js:94-98`), then a tangled tree (`_properties.js:648-658`). The relationship aliases come from `K.rel()` (`_concepts.js:65-77`): `MEMBER` is `IS_A_PROPERTY_OF`, `PRIMARY` is `IS_THE_PRIMARY_PROPERTY_FOR`, `SCHEMA` is `IS_THE_JSON_SCHEMA_FOR`.
4. **The lock.** Every property write takes the lock on the concept's header first, `S.lockNode(tx, concept)` (`add-property.js:84`; `_sets.js:257-260`), ADR 0018 Decision 11.
5. **The write path and change entries.** A write declares `apply`, `guards` and `repeatKey`, and returns `{ data, changes }`; the path records one entry for its changes in the same transaction (`write.js`). An entry's `keys`, which `graph history` filters by, are every tapestryKey in a change's `node`, `from`, `to` and `concept` (`changes.js:95-101`). `graph remove-relationship` already records `{ change: 'relationship-removed', type, from, to, count }` (`remove-relationship.js:57`).
6. **Reads share paging.** `src/operations/reads.js` C1 gives `LIMIT_INPUT`, `CURSOR_INPUT`, `INVALID_CURSOR`, `encodeCursor`, `decodeCursor` and `pageOf`, and C3 a node's answer (`NODE`, `nodeOf`): tapestryKey ascending for a list of nodes.
7. **Firmware's graph rule items** are made from the rulebook and each rule's `summary`, `refuses` and `refusals` by `node src/firmware/graph-rules.js`, and a stack-free test fails while the committed element files differ from what it makes (`src/firmware/graph-rules.js:1-15`, `:212-214`).
8. **The old enumerate route** (`src/api/normalize/index.js:4128-4262`). With `createProperty`, it signs a property whose d-tag is `childDTag(propName, <property concept's address>)` and gives it no parent (`:4161-4175`). Then, for any property, it hangs it on the target concept's JSON schema node, signing a relationship event for that link, unless the link is there (`:4209-4243`). It answers `schemaWired` (`:4251`).
9. **The old create-property route** (`src/api/normalize/index.js:3468-3652`). A property given no parent hangs on the concept's JSON schema node (`:3492-3505`), and every property's d-tag is `childDTag(trimName, <property concept's address>)` (`:3532`), so a name made under two parents is one node with two parents. The New Property form passes the primary property as the parent by default (`ui/src/pages/concepts/NewProperty.jsx:50-54`). An unknown concept, or one with no schema, is answered `{ success: false, error }` with status 200, the route's style. `POST /api/normalize/skeleton` makes a concept's missing core nodes (BIBLE §11's API table, `BIBLE.md:478`).
10. **Nothing makes the link again from a letter.** `IS_A_PROPERTY_OF` is in no tag (BIBLE §22's deferred list keeps it a reserved-future candidate). The only readers of `nodeFrom`, the tag a relationship element names its ends with, are the normalize routes that write it and firmware's manifests (`src/firmware/install.js:560-610`, `_sets.js:286-357`, `_memberships.js:392-449`, all over firmware's own files). `src/api/io.js:545-600` makes edges from an uploaded export's graph-type words, which hold a concept's property tree graph, and the property writes rebuild that from the tree. No derive step reads `IS_A_PROPERTY_OF` (nothing under `src/lib/derivers/`). So the old route's relationship element stays in the graph and on the relay, and nothing turns it back into a link.
11. **The live case** (david.tapestry.ninja, read 2026-11-19 through its public read route): of 175 property nodes, 174 hang under one parent, and grok bot's `project` (`7675c11c-e9ee-4310-9c44-b5c8824ea5cb`) under two: its primary property (`7a16470e-7cc5-4174-b5a8-1bca81f0162f`) and its JSON schema node (`8a31de59-06af-4abb-aaad-aa69b0b5b6a7`). No property there hangs under nothing. The route's relationship element is `55641f3d-db36-4359-98d3-cd7528cec4d8`.

Concepts, by handle (checked against david.tapestry.ninja's graph; `<TA>` is each instance's assistant pubkey, never written into code): `39998:<TA>:property`, `39998:<TA>:primary-property`, `39998:<TA>:json-schema`, `39998:<TA>:graph-rule` (gains an item at the next install) and `39998:<TA>:relationship` (holds the old route's relationship elements). No concept's definition changes.

## Options considered

### Option A — the rule declares how to scan, its findings carry their fix, and two `rules` operations run them

The rule file gains one optional part, `scan(read, scope)`, which lists the items a check over a scope judges and judges nothing itself. Its `violations` stays the one definition: it judges each item, and each finding says what would fix it (a plan of links to take off), or that nothing can and why. `rules check` is a read: it scans, judges and pages the findings. `rules repair` is a write through the write path: it locks the concepts involved, judges again inside its transaction, applies each plan the repair policy allows (own concepts; firmware's with the override; never another author's), and records one change entry.

- Pros: the judging is defined once and reused by both operations, as design D3 asks; the next rule to join check adds its own `scan` and nothing else; repair judges the graph as it is when it writes, so it can never remove a link a check saw a minute ago that is now right; the firmware override and the other-author choice are written once, in the repair, for every rule.
- Cons: the rule contract changes (one optional function, and the loader's checks); a finding grows past `{ item, code, message }` (as `element-fits-schema`'s already does, with `missing` and `derivedAt`).

### Option B — untangle inside the property writes' catching up

ADR 0018's load (step 6) would drop a property's link to its own concept's schema before it judges the tree, so the next property write on grok bot heals it.

- Pros: no new operation and no new rule code; every property write heals the concept it touches.
- Cons: it isn't what the story asks: nothing reports what is wrong (AC2), the graph can't be checked without writing, and a heal happens as a side effect of an unrelated write, recorded as a catch-up change. Firmware concepts are refused by the property writes before step 6 (`firmware-concept`), so the override has nowhere to go. It changes ADR 0018's contract that a tangled tree is refused and nothing changes.

### Option C — let `graph remove-relationship` take this one `IS_A_PROPERTY_OF`

Rule 2 (`relationship-type-allowed`) would allow `IS_A_PROPERTY_OF` when it runs from a property that isn't a primary property to a JSON schema node.

- Pros: a few lines; Zeus could fix grok bot today with one call.
- Cons: no check: the caller has to find the stray links itself. It cuts a hole in ADR graph-operations-foundation/0004 Decision 6's reservation, which keeps the property tree's links in the property operations. It has no firmware policy, and it doesn't know whether the property keeps a parent afterwards. It isn't the story either (AC2, AC3).

## Decision

We chose **Option A**. It is the shape the rulebook and the ledger row already expect (`rules check` reports, `rules repair` removes the extra link), it keeps one definition for judging, and it gives the next rules a place to join check and repair by adding a `scan` and, where they can, a plan in their findings. Option B hides the problem inside unrelated writes, and Option C undoes a reservation the write path relies on. We trade away a smaller change today for an operation pair that A10.31's other rules reuse.

### Decision 1 — the rule, `src/operations/rules/property-has-one-parent.js`

- `name: 'property-has-one-parent'`, `refuses: false`, `refusals: []`. It guards no write (story, Out of scope): no new write can break it, and the property writes keep refusing a tangled tree.
- **Items:** `{ node }`, a tapestryKey. An item that isn't a `Property` node, or one that hangs under nothing, gives no finding (story, open question 3). A node is a **primary property** when it has `IS_THE_PRIMARY_PROPERTY_FOR` to a header.
- **What it says.** Every property node that hangs under anything hangs, by `IS_A_PROPERTY_OF`, under exactly one node: a primary property under its own concept's JSON schema node (the one with `IS_THE_JSON_SCHEMA_FOR` to the header it is primary for), and every other property under a `Property`.
- **Its codes**, one per finding, judged in this order:
  - `primary-property-misplaced`: a primary property under more than one node, or under one that isn't its own concept's JSON schema node;
  - `more-than-one-parent`: any other property under more than one node;
  - `parent-not-a-property`: any other property whose one parent isn't a `Property` (a JSON schema node, or another kind of node).
- **Its reads**, two, each over every item at once with `UNWIND`, so a check of the whole graph costs two reads, not two per node:
  - V1: each item's labels, name, address and author; whether it is a primary property, and of which header; and each parent's tapestryKey, name, address, labels, whether it is a primary property (and of which header), and, for a `JSONSchema` parent, which header it is the schema for.
  - V2, only for items with a finding: the concepts whose trees hold the item, by `CONCEPT_OF`'s chain (`(p)-[:MEMBER*1..33]->(:Property)-[:PRIMARY]->(h)`, `h` a `ConceptHeader` or `ListHeader`), and each such header's and each parent's header's tapestryKey, name, address, author and uuid. Firmware is judged with `K.isFirmware(uuid)`, required lazily (the rules index's no-load rule).
- **Each finding** is `{ item, code, message }` plus the facts check answers (Decision 3): `node`, `primary`, `concepts`, `parents`, and either `fix` or `choice`. Its `message` names the node, its parents and what the rule says, in words, such as "grok bot's property project (7675c11c-…) hangs under 2 nodes, the primary property for the concept of grok bots and the JSON schema for the concept of grok bots, where a property hangs under one: its concept's primary property, or its parent property".
- **`fix`**, the one case it plans (AC3): a `more-than-one-parent` finding where the node's trees name exactly one concept `H`; exactly one of its parents is a `Property` in `H`'s tree (the chain reaches `H`'s primary property); and each other parent is a `JSONSchema` node that `IS_THE_JSON_SCHEMA_FOR` `H`. The plan is `{ concept: H, removes: [{ type: 'IS_A_PROPERTY_OF', from: <node>, to: <schema> }, …] }`. Every other finding has `fix: null` and a `choice` (Decision 3).

### Decision 2 — `scan`: how a check knows what to judge

`src/operations/rules/index.js` gains one optional part of a rule, `scan: async (read, scope) => items`, the items a check over `scope` judges; `problemsOf` checks that it is a function when it is there. `scope` is `{ kind: 'graph' }`, `{ kind: 'concept', key }` or `{ kind: 'node', key }` (Decision 4). A rule with no `scan` can't be run by check yet, and check says so (`not-checkable`, Decision 5). Only this rule has one in this story (story, open question 1).

`property-has-one-parent`'s `scan`, each answering `{ node }` items in tapestryKey order:
- **graph:** every `Property` with at least one `IS_A_PROPERTY_OF` out: `MATCH (p:Property)-[:MEMBER]->() RETURN DISTINCT p.tapestryKey`;
- **concept:** its primary properties, every `Property` reaching one by `MEMBER*1..33`, and every `Property` hung directly on one of its JSON schema nodes;
- **node:** the node, when it is a `Property`; otherwise no items.

`scan` lists; it never judges, so the rule's definition stays its `violations`.

### Decision 3 — what a finding answers, and its id

Check answers each finding as:

```
{ id, rule, code, message,
  node: NODE (reads.js C3), primary: boolean,
  concepts: [{ tapestryKey, name, address, own, firmware }],          // the trees it is in; for a primary property, its concept
  parents:  [{ ...NODE, kind, concept, ofItsConcept }],                // kind: primary-property | property | json-schema | other
  fix:    { concept, removes: [{ type, from, to }], firmware } | null, // firmware: the concept is firmware's (needs the override)
  choice: { why, wayOn } | null }
```

- `concept` on a parent is the header it belongs to (the concept a primary property or a schema is for, or whose tree a property is in), or null; `ofItsConcept` says whether that is one of the node's own `concepts`, so a caller can tell its concept's schema from another's (AC2).
- **`choice`** says why nothing is planned and how to go on, naming an operation where there is one, and saying where there is none:
  - a property under two of a tree's properties, or under two concepts' trees: no operation takes out one of its links yet; the property writes refuse the concept (`tangled-tree`), and `graph remove-property` with them; A10.31's later repairs, or the owner, decide;
  - a property whose only parent is a JSON schema node: it is in no tree; the concept's property writes (`graph add-property`, `graph set-schema`) give its field a node in the tree;
  - a primary property misplaced: `POST /api/normalize/skeleton`, or the owner;
  - another kind of parent: named, with no operation.
- **`id`** is `property-has-one-parent:<node>:<digest>`, where `<digest>` is the first 12 hex digits of SHA-256 over the canonical JSON of `{ code, node, parents: [their tapestryKeys, sorted] }`. The same finding on the same graph always has the same id, and any change to the node's parents changes it, which is how repair knows the graph moved since the check (Decision 6). The digest is computed in `catalog/rules/_rules.js`, so a later rule's findings get ids the same way.

### Decision 4 — the scope input

Both operations take `scope`, a string: `graph`, or a tapestryKey. A key that names a concept header (`ConceptHeader` or `ListHeader`) is that concept; any other node is that node. A key that names no node, a change entry or a tag is refused `unknown-node` (404), the code graph's reads use, with its own `when` for `scope`, naming the input. The parsed scope is what `scan` receives (Decision 2).

### Decision 5 — `rules check`, `src/operations/catalog/rules/check.js`

- A read, `owner-and-admins`, at `GET /api/tapestry/rules/check`.
- **Inputs:** `scope` (required, Decision 4); `rules` (optional, up to 20 names, one value each, as walk's `types`), every rule with a `scan` when left out; `limit` and `cursor` (reads.js C1).
- **Run:** for each rule named, `scan(read, scope)`, then `violations(items, read)`, over `graph.read`. Findings are sorted by the node's tapestryKey, then by rule, and paged by C1; a cursor's position is the last finding's `[node, rule]`, its scope fingerprint the scope and rules. The query is the whole check each page, as a walk reads its whole walk (C1), since the findings are computed, not stored.
- **Answer:** `{ scope: { kind, tapestryKey?, name? }, rules: [names run], judged, found, violations: [page], cursor }`. `judged` counts the items scanned, `found` every finding across all pages.
- **Refusals:** `unknown-node` (404); `unknown-rule` (400, a name the rulebook's code doesn't hold, naming it and the rules that exist); `not-checkable` (409, a rule with no `scan`, naming it and saying A10.31 will run it); `invalid-cursor` (400, C1's). It changes nothing and records nothing.

### Decision 6 — `rules repair`, `src/operations/catalog/rules/repair.js`

- A write through the write path, `owner-and-admins`, at `POST /api/tapestry/rules/repair`. `guards: []`: the rule refuses nothing, and repair judges inside `apply` (the move-element pattern, ADR 0023 Decision 7).
- **Inputs:** `violation` (a finding's `id`), or `rule` and `scope` together; and `firmwareOverride` (boolean, false by default). Both forms, or neither, are refused `bad-target` (400). `repeatKey: ['violation', 'rule', 'scope', 'firmwareOverride']`.
- **Steps**, in this order, so a refusal changes nothing:
  1. the inputs: `violation` parses as `<rule>:<tapestryKey>:<12 hex>` (else `unknown-violation`, 400); the rule exists (`unknown-rule`) and has a `scan` (`not-checkable`); a `scope` names a node (`unknown-node`);
  2. **candidates:** for a `violation`, its node; for a scope, `scan` in the transaction;
  3. **the concepts to lock:** the rule judges the candidates once (`violations`), and the repair takes every `fix.concept` among them;
  4. **the locks:** `S.lockNode(tx, key)` on each such concept's header, in tapestryKey order, at most 100 (Decision 8), so two repairs, or a repair and a property write on one concept, go one after the other without a deadlock;
  5. **judged again,** after the locks: `violations` over the same candidates, so what is written is judged on the graph as it is now;
  6. **for a `violation`:** no finding on its node for its rule answers `outcome: nothing-to-repair`, `change: null` (the repeat, AC3); a finding whose `id` differs is refused `changed-since-check` (409), giving the finding as it is now so the caller can check again; a finding with no `fix` answers `outcome: left` with its `choice`, changing nothing;
  7. **the policy** (Decision 7) on each finding with a `fix`;
  8. **the writes:** for each allowed fix, each planned link is taken off with remove-relationship's statement (`MATCH (a {tapestryKey: $from})-[r:IS_A_PROPERTY_OF]->(b {tapestryKey: $to}) … DELETE r`), counting what went;
  9. **after the writes:** `violations` over the fixed nodes once more, inside the transaction; a fixed node that still has a finding is a failure (500), so the transaction rolls back rather than record a repair that didn't repair;
  10. **the letters:** for each removed link, the relationship elements that record it, found by their tags (`relationshipType` `IS_A_PROPERTY_OF`, `nodeFrom` the property's uuid, `nodeTo` the schema's uuid), answered by tapestryKey and address with the way on, `graph delete-node`. None is deleted (story, Out of scope).
- **Answer:** `{ outcome, fixed: [{ id, node, concept, removed: [{ type, from, to, count }], firmwareOverride, letters }], left: [{ id, node, why, wayOn }], remaining, change }`. `outcome` is `repaired` when anything was fixed, `nothing-to-repair` when nothing was found, and `left` when findings were found and none could be fixed. `remaining` counts the fixable findings past the cap (Decision 8).

### Decision 7 — whose concepts a repair may change

For each finding with a `fix`, by its concept's header:
- the instance's own (its author is the instance's assistant, `K.assistant()`, and `K.isFirmware(uuid)` is false): fixed;
- a firmware concept: fixed only with `firmwareOverride: true`. Without it, a `violation` repair is refused `firmware-concept` (409), naming the concept and the input to pass; a scope repair fixes the rest and lists the finding in `left`, with that way on (AC5). A repair made with it records `firmwareOverride: true` in its change (Decision 9). A firmware reinstall doesn't put the link back (Context 10): firmware's trees are built from its files, which hold no such link;
- another author's: never fixed; listed in `left` as a choice, saying the tree is that author's claim (D4).

This is the owner's change at the story gate (story, open question 2).

### Decision 8 — how much one repair does

A scope repair fixes at most **100** findings per call, those first by the node's tapestryKey, and answers how many fixable findings remain (`remaining`); the caller calls again. That keeps one transaction's locks, writes and change entry bounded, as the property writes bound theirs (ADR 0018 Decision 4). A check pages without a cap (Decision 5).

### Decision 9 — the change entry

One entry per repair that changed anything. Each removed link is one change:

```
{ change: 'relationship-removed', type: 'IS_A_PROPERTY_OF', from: <property>, to: <schema>, node: <property>,
  concept: <header>, rule: 'property-has-one-parent', count, firmwareOverride: true? }
```

So `graph history` finds it by the property, the schema node and the concept (Context 5). `src/operations/changes.js`'s `CHANGE` gains `rule` (string) and `firmwareOverride` (boolean) in its properties and its comment. Nothing is signed (the write path's Decision 10).

### Decision 10 — what a repair leaves as it was

The property's address, tapestryKey, tags, JSON, its `ENUMERATES` and its `HAS_ELEMENT` from the `property` concept stay as they were, and so do the JSON schema node and the property tree graph: none of them holds the link (the property writes rebuild the tree graph from the tree, which the stray link was never part of). No letter goes out of date, since no tag records the link (Context 10), and no cached JSON does (no derive step reads it). The answer names the relationship elements that still record the link (Decision 6, step 10), which are the only trace left.

### Decision 11 — the old enumerate route

In `handleEnumerate` (`src/api/normalize/index.js:4128`):
- **The schema block goes** (`:4209-4243`): the route adds no `IS_A_PROPERTY_OF` to any JSON schema node and signs no relationship event for one. `schemaWired` stays in the answer, always `false`, so a caller that reads it doesn't break (D15).
- **With `createProperty`,** before anything is signed, the route finds the target concept's primary property, by the same name match its schema query used (`(h)-[:HAS_TAG]->(t)` with `name` or `names`, then `(pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)`, `LIMIT 1`). None is answered `{ success: false, error }`, naming the concept and `POST /api/normalize/skeleton`, and nothing is signed. The new property's d-tag is `dtag.childDTag(propName, pp.uuid)` (BIBLE §6's address rule), and once it is imported the route merges `IS_A_PROPERTY_OF` from it to the primary property, as create-property does, with no relationship event.
- Everything else stays (D15): the name lookups, the `ENUMERATES` and its event.

### Decision 12 — the old create-property route

In `handleCreateProperty` (`src/api/normalize/index.js:3468`):
- **A property given no parent** hangs under the concept's primary property: the top-level query (`:3492-3505`) matches `(pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)` in place of the schema node. None is answered `{ success: false, error }`, naming the concept and `POST /api/normalize/skeleton`.
- **Every property's d-tag** is `dtag.childDTag(trimName, targetUuid)`, the parent's address, in place of the property concept's (`:3532`). So the same name under two parents is two nodes, and the route gives the same address `graph add-property` and `generate-property-tree` give the same property (BIBLE §6).
- A node made before under the old address keeps it; nothing is migrated. If it is shared by two parents, check reports it, and repair leaves it as a choice (Decision 3).
- Everything else stays (D15), the duplicate check under the same parent included.

### Decision 13 — the docs

- `docs/GRAPH_RULES.md` gains entry **11, `property-has-one-parent`**, in its format: Says (Decision 1), Kind (a graph rule, about every property node, whoever made it), Refuses or reports (it only reports), Check (`rules check`, Decisions 2 and 5), Repair (`rules repair`, Decisions 1, 6 and 7, and the choices it leaves), Enforced by (a check: `rules check`; `src/operations/rules/property-has-one-parent.js`), Status (enforced), Source (this ADR).
- `node src/firmware/graph-rules.js` then writes its firmware element, `firmware/versions/v1.0.0/concepts/graph-rule/elements/property-has-one-parent.json`, and the stack-free generator test passes again.
- `docs/GRAPH_OPERATIONS_CATALOG.md` §4: the `check` and `repair` rows say what is built (this rule, A10.31.a), and their "Today" columns name the new routes.
- The ledger row `2026-11-19-old-routes-hang-properties-on-schema` records what this story did (the two writers, and the repair); it stays OPEN for the readers, `generate-property-tree`'s fallback and firmware's `property-membership.json`.
- BIBLE §6's relationship table already says where a property hangs; nothing there changes.

## Consequences

- **It enables:** finding a tangled tree on any instance in one call, and fixing the common case, an old route's link to the schema, with a record of who did it; and a place for A10.31's other rules to join check and repair.
- **It constrains:** a rule that check runs must declare `scan`; a finding that repair can act on must carry a `fix` the repair knows how to apply, which today is only "take off these links". A later rule whose repair adds or changes something extends the plan's vocabulary, in its own ADR.
- **It leaves:** the choices of Decision 3 with no operation to act on them (a node two trees share, a property hung only on a schema node), the old enumerate route's name lookups, the readers the ledger row names, and the old route's relationship elements, which Zeus deletes by hand for grok bot (AC8).
- **The cap** means a graph with more than 100 fixable findings takes several repair calls; `remaining` says how many.
- **Firmware reinstall required?** No, for the behavior: check and repair run from the rule's code. The graph rule concept gains its eleventh item only at an instance's next firmware install, which waits for the owner, as rule 9's did.

## Implementation notes

- **New:** `src/operations/rules/property-has-one-parent.js` (Decision 1, with `scan` from Decision 2). Its two reads use `K.rel()`'s aliases, never literal type names, and `K.isFirmware` and `K.assistant()` required inside `violations`.
- **Changed:** `src/operations/rules/index.js`: the comment gains `scan`; `problemsOf` checks it is a function when present; a small `checkable(rule)` (or the check reading `typeof rule.scan === 'function'`).
- **New:** `src/operations/catalog/rules/_rules.js`, the shared part of both operations: parsing `scope` (Decision 4), finding the rules to run (Decision 5's refusals), running `scan` then `violations`, a finding's `id` (Decision 3), and the refusal declarations (`UNKNOWN_RULE`, `NOT_CHECKABLE`, `UNKNOWN_VIOLATION`, `CHANGED_SINCE_CHECK`, `BAD_TARGET`, `FIRMWARE_CONCEPT` with repair's own `when`, and `UNKNOWN_SCOPE`, code `unknown-node`). It opens nothing at load, like the other `_*.js` modules. Its file name starts with `_`, so the loader skips it.
- **New:** `src/operations/catalog/rules/check.js` (Decision 5) and `src/operations/catalog/rules/repair.js` (Decisions 6 to 9), each with a result schema; repair's declares `change: CHANGE_ENTRY` and `guards: []`.
- **Changed:** `src/operations/changes.js`: `CHANGE` gains `rule` and `firmwareOverride` (Decision 9).
- **Changed:** `src/api/normalize/index.js`, `handleEnumerate` (Decision 11) and `handleCreateProperty` (Decision 12). No other route there changes.
- **Docs:** Decision 13, then `node src/firmware/graph-rules.js` to write the element file.
- **The suites** are the Tester's: `test/operations/rules/` for the rule and the two operations, over `test/helpers/graphFake.js` where its statements reach, or the Neo4j the property operations' suites use; the two old routes in their own suite. The graph fake runs only the statements it lists (`graphFake.js:1-30`); the rule's `UNWIND` reads are likely beyond it, as the property operations' reads are, so the Tester picks which suites need a real Neo4j.
- **On this Mac,** never the full `npm test`: the local container is the agent-memory instance (the scoped gate the Tester names, with stub `curl` and `docker` first on PATH).
- **The live check (AC8)** runs on a scratch stack, not the local instance. The tangle has to be made there before the repair: by `POST /api/normalize/enumerate` from a checkout before this change, or by one `MERGE` through `cypher-shell` inside the scratch container. That is test setup, not the operation under test. Then, through the external CLI as an admin: check, repair, check, `graph update-property`, repair again.
- **On david.tapestry.ninja,** once the change reaches it and on the owner's yes: `tapestry-zeus rules check --scope graph`, then `tapestry-zeus rules repair --violation <id>` for grok bot's `project`, then `tapestry-zeus graph delete-node --node 55641f3d-db36-4359-98d3-cd7528cec4d8`, then a check again.
- **Branches:** staging only. The change reaches the hosted instances from staging, and production waits for the owner's OK (the book's frame).

## Amendment 1 — check says what repair will do with another author's concept (Test Design, 2026-11-20; accepted by the owner)

Mapping AC2 to tests found a gap. As Decision 1 was written, a finding's `fix` depended on the tree's shape alone, so `rules check` would offer a fix for a property in another author's concept that `rules repair` then leaves (Decision 7). AC2 asks check for "the repair that fixes it, or that none does and why".

So a finding in a concept that isn't the instance's own (its header's author isn't the instance's assistant), firmware's aside, carries `fix: null` and a `choice` saying the tree is that author's claim (D4). This covers another author's concept and one under the owner's own key. Decision 1's fix rule gains that condition. Decision 7's other-author case stays in the repair as a guard, and is never reached through check's findings. Firmware's findings keep their `fix`, marked `firmware: true`, as Decision 3 says.

## Amendment 2 — the old routes refuse an address another node holds (review round 1, 2026-11-20)

Decisions 11 and 12 give a property the old routes make its parent's address: `childDTag(name, parent's address)`, BIBLE §6's rule. That rule slugs the name, so names that slug alike, such as `first_name` and `first-name`, share an address under one parent. Neither route's duplicate check sees it: create-property compares names exactly, and enumerate ignores only case.

The routes then sign an event at an address another node already holds, and `importEventDirect` takes that node over. It deletes every tag the node has, its `json` included, and the route answers that it created the property. Review round 1 reproduced this on a node `graph add-property` made with no event. That loses graph state the instance made, which BIBLE §30 forbids.

Before Decisions 11 and 12, the old routes took every address from the `property` concept. Only their own nodes used those addresses, so the risk was new with them.

So both routes, before they sign anything, read whether a node holds the new property's address. If one does, they refuse, `{ success: false, error }` at status 200 in the routes' style (D15), naming that node and its address, and nothing is signed or written. The way on is to use that property, or to choose a name that slugs differently.

The other choice was the property writes' versioning nonce (`~1` to `~99`, ADR 0018 Decision 5), so a slug-alike name becomes a second node. That keeps the call working, but it leaves two near-namesakes under one parent. A refusal is the cheap fix D15 allows, and it changes nothing that exists. Tests OR8 and OR9.

## Out of scope

- `rules list-rules`, and `scan` for the other rules (A10.31).
- A guard for this rule in any write.
- Untangling a node two trees share, or moving a property hung only on a schema node into its tree (Decision 3's choices).
- Deleting or retracting the old route's relationship elements (`graph delete-node` by hand; `export retract`, A10.34).
- The old enumerate route's name lookups; `generate-property-tree`'s fallback to the schema; the readers that expect a property's parent to be its schema; firmware's `property-membership.json` (the ledger row).
- Running the check or the repair on any instance other than the scratch stack and david.tapestry.ninja.
