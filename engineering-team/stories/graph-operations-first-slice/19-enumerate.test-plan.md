# Test Plan: Story 19 — `graph enumerate`, `graph unenumerate`, and rule 10 `enumerated-value-allowed`

**Story:** `engineering-team/stories/graph-operations-first-slice/19-enumerate.md` (as amended at Architecture)
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0019-enumerate-and-unenumerate.md` (accepted: Option A, with the four story amendments)
**Date:** 2026-11-18

Every suite is stack-free:
- the operation suites run the real catalog in a child process (`test/helpers/operationsHarness.js`) over the fake graph (`test/helpers/graphFake.js`), with every service endpoint dead, each element's tapestryJson in a throwaway LMDB, and the harness's spy on everything that signs or reads a key;
- the agent suite runs the real catalog behind `test/helpers/externalCliServer.js`, the agent being `clients/cli/bin/tapestry.js` with an admin's own key;
- the rule suite calls the rule's one definition, `violations(items, read)`, in a child, through graphFake's `readerOver`, as rule 4's suite does.

All live under `test/operations/`, where `test/operations.test.js` finds and runs them, so none needs a line in `test/registry.js`. The declaration-level suites (the listing, `/docs` with openapi-coverage's comparison, the route table, both CLIs) read the catalog themselves, so the two operations join them once declared.

The stack-free suites can't reach five things, which the live check covers on a scratch stack (below): Neo4j's own locking (two calls truly at once; here it is the fake's `failures.meanwhile`), a firmware reinstall, a restore on a fresh instance, nginx, and the relay.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: link a property to another concept | **EN1** one `ENUMERATES`, project's superset → bot's project node, no properties; the whole graph before and after compared: no `IS_A_PROPERTY_OF` added, no node or other relationship comes or goes, no node's properties change, one entry; nothing signed. **EN2** `enumerated`; `property` (key, concept, field, path); `source` `{ concept, name, superset }`; `caughtUp`, `filledIn`, `elements`, `letterOutOfDate`, `cacheOutOfDate`; one change, `enumeration-added` `{ type, from, to, concept, nodes }`. **EN3** `allowed`. **EN4** `values`. **EN5** history by the property, the source, the superset and the property's concept; list-relationships on the property lists the link, `in`, with `{}`. **EN6** the property's own concept as its source. **EN9** a firmware concept, and another author's, as the source. **EN14** the lock comes first | `test/operations/graph/enumerate.test.js` | integration (fake) |
| AC2: what a value is | **EN3** `allowed` is what `graph list-elements` lists for the source by default, by tapestryKey: own, the owner's, a peer above the cutoff, one with no author, one in a set below; not a peer below, at, or unscored, nor an admin below. **EN7** a nullable string, a list of strings, a nested field, a pattern and a length a reference meets. **EV2** a name, a slug, an address, a `nostr:` link, an uppercase key, a bare key, `""`, a number are not references. **EV3** no node; another concept's element; the source's own header and superset. **EV4** below the cutoff, at it, unscored, an admin below it. **EV5** allowed. **EV6** a list item by item. **EV7** null and absent not judged. **CE51** allowed references made | `enumerate.test.js`, `test/operations/rules/enumerated-value-allowed.test.js`, `create-element.test.js` | integration (fake); rule |
| AC3: the writes check values, which follow the source | **CE50** create-element refused `value-not-allowed` (400, the rule named): a name, a list holding one, a nested field's, a peer's below the cutoff, an uppercase key; the words name the field (`bot.project`), the value, the source by name and key, and `graph resolve`, `graph list-elements`, `graph create-element`; nothing written. **CE52** an element create-element adds to the source after the link is allowed at once; one taken out with remove-from-concept, or deleted with delete-node, is refused. **CE53** Grok Bots' tangled concept is checked. **UN50–UN53** update-node: refused with nothing written; a reference updated; every finding named in one refusal; an element written before the link can't change another field until its value is a reference. **AT70–AT72** add-to-concept: refused with nothing changed; a reference added; not run when the JSON doesn't change. **EN4** the report: the elements written before the link whose value isn't allowed, everyone's, from their JSON; counted, named with field and values; never a refusal. **EV8–EV14** the rule's chain, paths, Grok Bots' shape, one read for a concept with none, firmware's edge ignored, the finding's shape, reads that don't grow with the items, the message | `create-element.test.js`, `update-node.test.js`, `add-to-concept.test.js`, `enumerate.test.js`, `enumerated-value-allowed.test.js` | integration (fake); rule |
| AC4: safe to repeat | **EN10** the same call: `already-enumerated`, `change: null`, the allowed list and the report, one link, one entry. **EN11** a link today's route made from the same superset is a repeat. **EN12** two at once, through `failures.meanwhile` on the header's lock: one link, the second `already-enumerated`. **EN13** a repeat that finds the tree behind the schema catches up and records that alone (amendment 4). **XN1** the agent's repeat | `enumerate.test.js`, `enumerate-agent-through-cli.test.js` | integration (fake) |
| AC5: take the link back | **UE1** a link graph enumerate made goes; the whole graph compared: nothing else changes, no element changes; nothing signed. **UE2** `unenumerated`, `property`, `source`, `removed`, `letters` `{ addresses, searched }`, the property writes' fields, one `enumeration-removed`. **UE3** history by the property, the source, the superset and the property's concept; list-relationships lists none. **UE4** judged by the schema alone again. **UE5** today's route's letter is named. **UE6** two links from two starts both go, counted; one from a set. **UE7** again, or none: `not-enumerated`, `change: null`, `source: null`. **UE8** with a catch-up (amendment 4). **UE16** firmware's edge stays. **UE17** the lock | `test/operations/graph/unenumerate.test.js` | integration (fake) |
| AC6: what it refuses | Each refusal (table below), each with its code and the status its declaration lists; **EN22**, **UE11** the whole refusal run changed nothing and recorded nothing, paired with every call having been refused by the operation | `enumerate.test.js`, `unenumerate.test.js` | integration (fake) |
| AC7: it lasts, and reaches agents | **EN24**, **UE13** 401, 403, 415; an admin's is the admin's; nothing signed. **EN25**, **UE14** the internal command, recorded as `local`; its refusal is the route's. **EN26**, **UE15** listed (write, owner and admins, guard `element-fits-schema`, `repeatKey`, inputs, every refusal); `/docs` has the POST. **XN1** the story's agent sequence, through the external CLI with no change to it. **CE14**, **UN11**, **AT19** the element writes list rule 10's guard and `value-not-allowed` (400). **EN29**, **MF15** the catalog. **EV15**, **EV16** and the three rule lists: the rulebook's entry 10 and its firmware element. **L1–L8** (live) | the suites above; `test/operations/graph/enumerate-agent-through-cli.test.js`; live | integration (fake); live |

### The refusals

| Code (status) | Test | Cases |
|---|---|---|
| `unknown-property` (404) | **EN16**, **UE9** | a key that names no node; bot's primary property; bot's header; an element. Each names `property` and the key |
| `not-own-concept` (409) | **EN17**, **UE10** | nostr relay's motto (another author's); recipe's dish (the owner's own key's) |
| `firmware-concept` (409) | **EN17**, **UE10**, **XN1** | word's spelling, under a primary property given to firmware word |
| `tangled-tree` (409) | **EN17**, **UE10** | Grok Bots' project (under its primary property and its JSON schema node; its link stays); hut's door |
| `not-enumerable` (409) | **EN18** | a number; an object; a list of objects; a list with no `items`; `["string", "number"]` |
| `refuses-references` (409) | **EN19** | its own `enum`; `const`; `pattern: ^nostr:`; `maxLength: 44`; `minLength: 46`; an `enum` in `items`; a `maxLength` in `items`. Each names `graph update-property` |
| `enumerated-elsewhere` (409) | **EN20** | a link from project's superset, asked from person: names that start, project and `graph unenumerate`; a link from a set: names the set |
| `unknown-concept` (404, `source`) | **EN21** | no node; an element; project's superset and a set under it, each naming project's header, the key to pass |
| `reserved-source` (409) | **EN21** | firmware word; graph context (key `graphContext`) |
| `no-superset` (409) | **EN21** | a header with none; one with two |
| `not-installed` (409) | **EN23**, **UE12** | no property concept |
| `reserved-type` (409, add-relationship) | **EN28** | `ENUMERATES` names `graph enumerate and unenumerate` |
| `value-not-allowed` (400, rule 10) | **CE50**, **CE52**, **CE53**, **UN50**, **UN52**, **UN53**, **AT70**, **XN1**, **EV1** | see AC3 |
| built-ins (400, 401, 403, 415) | **EN24**, **EN26**, **UE11**, **UE13** | missing `property` or `source`; a key that isn't one; an unknown input (`concept` to enumerate, `source` to unenumerate) |

"Declared" means the test pins the code, and checks that the operation's own listing gives it status 409 and that the answer has that status (ADR 0019 Amendment 1, settled at this gate).

## Edge cases

- [x] A nullable string (`["string", "null"]`) is linked (EN7); a null in it isn't judged (EV7, CE51).
- [x] The length boundary: `maxLength: 45` and `minLength: 45` accept a reference (EN7); 44 and 46 refuse (EN19). A reference is 45 characters.
- [x] A link from a set, not a superset: enumerate refuses it as elsewhere (EN20); rule 10 never reads it (EV17, added at review round 1: until then no test checked it); unenumerate takes it out (UE6).
- [x] Two links into one property from two starts (UE6).
- [x] Firmware's edge to a JSON schema node, with a `destinationPath`, is never read or changed (EN27, EV12, UE16).
- [x] Grok Bots' shape: refused by both writes (EN17, UE10), its link kept, and still checked by the element writes (CE53, EV9).
- [x] The source's own header, or its superset, named by a value, isn't an element of it (EV3).
- [x] A source of 60 elements: 50 named, the first by tapestryKey, `more` true (EN15).
- [x] A peer scored exactly at the cutoff isn't above it (EN3, EV4). An admin counts by score, like anyone (EV4).
- [x] The values follow the source with no further call: added, taken out, deleted (CE52).
- [x] A refusal changes nothing: each refusal run is compared whole before and after (EN22, UE11, CE50, UN50, AT70).
- [x] Concurrent calls: EN12 through `failures.meanwhile`; L2, live.
- [ ] Concept Graph API unavailable: not applicable; every suite is stack-free.

**Not pinned on purpose:**
- The words of each refusal beyond what it must name (the key given, the operation to use).
- `input` on the refusals `P.load` gives (`not-own-concept`, `firmware-concept`, `tangled-tree`): the property writes give `concept`, an input these operations don't have.
- `source` in unenumerate's answer when the links have two starts, and when the start is a set.
- Whether `enumeration-removed` is one change per start or one for all: UE6 asks only that the changes name both starts and their counts add up to `removed`.
- The order of the element writes' two guards: CE14, UN11 and AT19 compare them sorted.
- `letters.searched`: present and not null (raised below).
- `values.notAllowed`: one entry per element and field; the seed never has an element break two fields at once.

## Test infrastructure

- **Runner:** each suite exports `run()`; `test/operations.test.js` discovers them.
- **The seed,** `test/helpers/enumerationGraph.js` (new), says what it holds. It starts from `test/helpers/propertyGraph.js`'s `prepare`, then runs the real `graph create-concept` (bot, project, person, grok bot, graph context) and `graph set-schema` (bot's, person's and grok bot's fields), so every field's property node is the one the property writes make. By hand it adds project's elements (by the assistant, the owner, peers above, at and below the cutoff, an unscored peer, the admin, no author, and one in a set below), the NostrUser scores, bot's elements written before any link, bare and twin headers, the relationship concept, Grok Bots' second parent, and the refused properties (relay's, recipe's, firmware word's). It makes no link: each suite makes the ones it needs with `link()` and `letter()`, as today's route makes them; `prepareLinked()` makes the element writes' set.
- **The fake graph learns two things** (both in test code, each with its own test in `test/operations/graph-fake.test.js`):
  - **F31:** `ENUMERATES` joins the types a read over paths may walk, so the reads of the link into a property, and of a concept's enumerated properties, run. A MERGE and a DELETE of the link are the statements the fake already runs between two keyed nodes.
  - **F32:** a read's `UNWIND` (ADR 0019 Decision 7: rule 10's second read is "all in one UNWIND"): one row per item, none for `[]` or null, one for a value that isn't a list. A statement that writes after an UNWIND is still a write.
- **The fake's limits the Implementer will meet:** no path variables or `nodes()` (a chain's names are read as each property's parent, as F31's read does); a relationship's DELETE names both ends by tapestryKey, written `(a …)-[r:ENUMERATES]->(b …)`.
- **Firmware state:** none on a live instance. The suites read the repo's active firmware for the firmware concepts and `json-schema.json` files.
- **Existing tests changed,** each because the ADR changes what it pins (the Implementer can't edit tests):
  - `create-element.test.js` CE14, `update-node.test.js` UN11, `add-to-concept.test.js` AT19: the guards are `element-fits-schema` and `enumerated-value-allowed`, and the refusals include `value-not-allowed` (400);
  - `mark-field.test.js` MF15: "At a glance" counts 62;
  - `test/operations/rules/relationship-type-allowed.test.js` R2: `ENUMERATES` is made by `graph enumerate and unenumerate`;
  - `test/graph-rule-firmware.test.js` `RULES`, `test/firmware-element-sync.test.js` `SCENARIO` and IS10's list, `test/graph-rules-builder.test.js` `REAL` and GB2's name: rule 10.

## How to run

Each suite alone, with every endpoint dead, `TAPESTRY_CONTAINER_PORT` unset, and stub `curl` (exit 7) and `docker` (exit 1) first on `PATH`:

```
BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 TAPESTRY_PORT=9 TAPESTRY_INSTANCE=http://127.0.0.1:9 \
MEILI_URL_HOST=http://127.0.0.1:9 NEO4J_URI=bolt://127.0.0.1:9 REDIS_HOST=127.0.0.1 REDIS_PORT=9 TAPESTRY_CONTAINER=no-such-container \
node -e "require('./test/operations/graph/enumerate.test.js').run().then(r => { console.log(JSON.stringify({pass:r.pass,fail:r.fail,skipped:r.skipped})); process.exit(0); })"
```

Do the same for `unenumerate.test.js`, `enumerate-agent-through-cli.test.js`, `test/operations/rules/enumerated-value-allowed.test.js`, the three element writes' suites, `mark-field.test.js`, `relationship-type-allowed.test.js`, `test/operations/graph-fake.test.js`, and `test/graph-rule-firmware.test.js`, `test/firmware-element-sync.test.js` and `test/graph-rules-builder.test.js`. Never run `test/operations.test.js` beside the suites it runs, and never the full `npm test` on the Mac Studio, whose stack is the agent-memory instance. The pull request's CI runs the full gate.

The three rule lists, EV15 and EV16 pass only once `docs/GRAPH_RULES.md` has entry 10 and `node src/firmware/graph-rules.js` has been run.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

As stories 22, 23, 26 and 28 did, it lives here and in the story's record, not in test code. Check `docker ps` and the shared notes before taking a scratch name, and take the stack down afterwards.

- **L1:** XN1's run through the external CLI, by an admin agent with its own key and no change to the CLI.
- **L2:** two enumerates of one property at once, fired from one node process in the container: one link, one `enumerated`, one `already-enumerated`, one entry.
- **L3:** a firmware reinstall: the link is there, and create-element still refuses a name in the field (AC7; BIBLE §30).
- **L4:** a backup restored on a fresh instance: the same.
- **L5:** today's `POST /api/normalize/enumerate` on a concept graph add-property made: the extra edge to the JSON schema node tangles the tree; enumerate and unenumerate refuse `tangled-tree`; create-element is checked against its link.
- **L6:** through nginx: a visitor gets 401 and a stranger 403.
- **L7:** a source of 1,000 elements: enumerate's time, and create-element's time with the check.
- **L8:** across L1–L7, the relay's event count is unchanged.

## Raised at test design, for the Architect or the owner

1. **The statuses of the five new codes** (`not-enumerable`, `refuses-references`, `enumerated-elsewhere`, `reserved-source`, `no-superset`). ADR 0019 named the codes but not their statuses. *Settled at this gate (ADR 0019 Amendment 1):* each is 409, as the existing refusals of their kind are (`reserved-key`, `no-superset`, `made-elsewhere`, `has-properties`, `marked-field`, `different-concepts`). The tests pin 409. Rule 10's `value-not-allowed` stays 400, as `invalid-fields` is.
2. **`format` can't refuse a reference.** AC6 (amendment 2) and Decision 4 listed "a `format` … a reference can't meet". Decision 4 compiles the piece with rule 4's ajv options, which add no formats; ajv 8.18 with `strict: false` then ignores every format, so `{ "format": "email" }` accepts `tapestry:…`. *Settled at this gate (ADR 0019 Amendment 1):* a `format` never refuses a reference, and AC6 and Decision 4 drop it. EN8 pins that a piece with a format can be linked.
3. **`letters.searched`:** its type isn't given (a sentence, or a boolean). UE2 and UE5 ask only that it is there.
4. **The external-CLI agent suite** is stack-free, as every existing `*-agent-through-cli` suite is: none of them skips without a scratch stack, and their scratch-stack runs live in each plan's live check (L1 here).
5. **Rule 10's Says** in the rulebook is the Implementer's to word: graph-rules-builder's REAL entry asks only that its first sentence is one.
6. **A null in a field whose type doesn't allow one:** Decision 6 says a null "in a field whose type allows it" isn't judged; the other case isn't said. Rule 4 refuses it anyway, and no test asks.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-18, on `A10.19-graph-enumerate` at `c708e530` (staging `9f1b4818` with the story and the ADR), with this phase's tests uncommitted beside it, each suite alone with every endpoint dead and the stubs first on `PATH`:

```
enumerate.test.js                     {"pass":0,"fail":29,"skipped":0}
unenumerate.test.js                   {"pass":0,"fail":17,"skipped":0}
enumerate-agent-through-cli.test.js   {"pass":0,"fail":1,"skipped":0}
rules/enumerated-value-allowed        {"pass":0,"fail":16,"skipped":0}
create-element.test.js                {"pass":33,"fail":5,"skipped":0}   CE14, CE50–CE53
update-node.test.js                   {"pass":41,"fail":5,"skipped":0}   UN11, UN50–UN53
add-to-concept.test.js                {"pass":56,"fail":4,"skipped":0}   AT19, AT70–AT72
mark-field.test.js                    {"pass":15,"fail":1,"skipped":0}   MF15
rules/relationship-type-allowed       {"pass":9,"fail":1,"skipped":0}    R2
graph-fake.test.js                    {"pass":33,"fail":0,"skipped":0}   F31 and F32 new
graph-rule-firmware.test.js           {"pass":12,"fail":1,"skipped":4}   GF9
firmware-element-sync.test.js         {"pass":20,"fail":1,"skipped":0}   IS8
graph-rules-builder.test.js           {"pass":21,"fail":5,"skipped":0}   GB2–GB6
```

The reasons, a line of each kind:

```
  FAIL  EN1 [AC1, Decision 1]: the link is one ENUMERATES from project's superset to bot's project node, carrying nothing; nothing else changes and nothing is signed
        src/operations/catalog/graph/enumerate.js does not exist yet (ADR graph-operations-first-slice/0019 Decision 2)
  FAIL  EV1 [Decision 7]: the rules' loader finds it: its name, a summary, refuses: true, and its one refusal, value-not-allowed (400)
        src/operations/rules/enumerated-value-allowed.js does not exist yet (ADR graph-operations-first-slice/0019 Decision 7)
  FAIL  XN1 [AC7]: the agent links a field to another concept, ...
        src/operations/catalog/graph/enumerate.js does not exist yet (ADR graph-operations-first-slice/0019 Decision 2): the external CLI exited 2: 'graph enumerate' isn't among the operations npub1… may call on http://127.0.0.1:…
  FAIL  CE14: it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry
        a write for the owner and admins, guards element-fits-schema and enumerated-value-allowed, repeatKey [concept, name]; got {"kind":"write",…,"guards":["element-fits-schema"],…}
  FAIL  R2: a reserved type is refused reserved-type, declared in the graph or not, naming what makes it
        ENUMERATES's refusal names the type and what makes it (/graph enumerate and unenumerate/); got "ENUMERATES is reserved: it is made by graph enumerate, with the checks it needs. …"
  FAIL  IS8: a lookup that fails is recorded as an error, the element isn't created blindly, and the install goes on
        all 10 elements were looked up, the ones after the failure included; got 9
```

XN1 fails after the agent's two create-concepts, its add-property and its create-element succeeded, so the agent, the server and the seed work.

**The existing tests in the suites changed here**, before (on `c708e530`, the tests as they were) and after:

| Suite | Before | After, the old tests | Old tests failing on purpose |
|---|---|---|---|
| create-element | 34/0 | 33/1 | CE14 |
| update-node | 42/0 | 41/1 | UN11 |
| add-to-concept | 57/0 | 56/1 | AT19 |
| mark-field | 16/0 | 15/1 | MF15 |
| relationship-type-allowed | 10/0 | 9/1 | R2 |
| graph-rule-firmware | 13/0, 4 skipped | 12/1, 4 skipped | GF9 |
| firmware-element-sync | 21/0 | 20/1 | IS8 |
| graph-rules-builder | 26/0 | 21/5 | GB2–GB6 |
| graph-fake | 31/0 | 31/0 | none |

Each failing old test fails on what the ADR changes: rule 10's guard beside rule 4's, the catalog's 62, the reserved-type words, or rule 10's rulebook entry and element.

**Each test gets past its declaration check.** Copies of the two operation suites in the session's scratchpad ran with the check turned off: enumerate 0/29, unenumerate 0/17. Every failure is the missing feature:
- `404 Cannot POST /api/tapestry/graph/enumerate` or `…/unenumerate`;
- the internal command's `Unknown operation 'graph enumerate'`;
- the listing, the reserved-type words, or the catalog.

That run caught three tests that passed on a 404: EN22 (the refusal run changed nothing), EN27 (firmware's edge untouched) and UE4 (a name accepted once unlinked). Each now first asserts that the path under test ran, as UE11 did from the start.

**A faithful implementation passes them.** Following story 23's practice, a throwaway reference was written from ADR 0019 alone, in a `git archive` copy of `c708e530` in the session's scratchpad, with this phase's tests laid over it; it never entered the repository. It covered `_enumerations.js`, enumerate, unenumerate, rule 10, the second guard and its call in the three element writes, `relationshipEvents`' `type`, the reserved-type words, rulebook entry 10 (then `node src/firmware/graph-rules.js`), and the catalog rows. On it:

```
enumerate 29/0   unenumerate 17/0   enumerated-value-allowed 16/0   enumerate-agent-through-cli 1/0
create-element 38/0   update-node 46/0   add-to-concept 60/0   mark-field 16/0   relationship-type-allowed 10/0
graph-fake 33/0   graph-rule-firmware 13/0 (4 skipped)   firmware-element-sync 21/0   graph-rules-builder 26/0   element-fits-schema 11/0
```

**The tests bite.** Each wrong edit of the reference ran on its own, and the file was restored after each:

```
W1  rule 10 reads from everyone's point of view            EV4 EV6, EN4, CE50
W2  enumerate also hangs the property on the schema node    EN1 and 15 more (its tree is then tangled)
W4  rule 10 holds only the superset's direct elements       EV5, CE51
W5  unenumerate takes out the first start's link only       UE6
W6  update-node doesn't run rule 10                         UN50 UN52 UN53
W7  a key is read whatever its case                         EV2 (after EV2 was tightened: see below)
W8  add-to-concept runs rule 10 when the JSON doesn't change AT72
W9  enumerate doesn't ask whether the piece accepts one     EN19 EN22
W10 allowed keeps every author's elements                   EN3
W11 a repeat links and records again                        EN10 EN11 EN12 EN13 EN24 EN27
W12 unenumerate names no letter                             UE5
W13 a superset's refusal doesn't name its header            EN21
W14 rule 10 finds only fields directly under the primary    EV8, UN52, CE50
W15 enumerate takes no lock                                 EN12 EN14
```

W7 at first broke nothing: an uppercase key was still refused, as a key that names no node. EV2 now asks that a value that isn't a reference is refused as that, not as a key that names no node (Decision 7: the message says why).

**The fake's two new abilities break nothing.** On the real tree, each suite alone:

```
graph-fake 33/0   add-property 15/0   update-property 11/0   remove-property 8/0   set-schema 10/0
list-relationships 26/0   list-elements 30/0   walk 32/0   resolve 22/0   search 34/0   history 8/0
move-element 44/0   remove-from-concept 36/0   delete-node 40/0   concept-writes-take-header-lock 8/0   element-fits-schema 11/0
```

**Left to Review, not tested:** BIBLE §6 and §29's paragraphs; ADR 0018's note at `:354`; the memo on A10.34 and the ledger row for the property writes that drop or break a link (ADR 0019 Implementation notes).

**At Implementation,** the scoped gate for a review's `gate:status` line is CI's own entries for an operations change, `operations.test.js` (which runs these suites) with `external-cli.test.js`, `openapi-coverage.test.js`, `admin-action-sweep.test.js` and `schema-save-finds-the-right-header.test.js`, never `operations.test.js` beside the suites it runs, and the three rule-list suites above.

## Review round 1's cases (2026-11-19, ADR 0019 Amendment 2)

Review round 1 (`engineering-team/reviews/graph-operations-first-slice/19-enumerate.md`) passed with six non-blocking findings. The owner chose to fix them before the pull request, so the tests come first.
- **Non-blocking 1 and 2** are Amendment 2's items 1 to 3. Those items are what the red cases pin.
- **Non-blocking 3** is a Tester's change. The review's four probes, and the story's two Deviations nothing pinned (bullets 1 and 3 of its "Deviations"), become guards.
- **Amendment 2's item 4** and non-blocking 4 to 6 change a ledger row and the records, so they have no test here.

A **red** case fails today and passes once Amendment 2 is built. A **guard** passes today and fails on its break.

| Case | Suite | What it pins | Kind |
|---|---|---|---|
| **EN30**, new | enumerate | Item 1: a list is tried with `max(1, minItems)` different references, at most 10,000. These are each `enumerated`, with one link from project's superset: `pair` (`minItems: 2`), `uniquePair` (that, with `uniqueItems: true`) and `tenThousand` (`minItems: 10000`). `overTenThousand` (`minItems: 10001`) is refused `refuses-references` at its declared 409, in words that name `minItems` and say 10,000. | red |
| **EN31**, new | enumerate | Item 2: `refuses-references` names what refuses, read from the check, each with `graph update-property`. `closed` (`maxItems: 0`) names `maxItems` and gives `{"maxItems": null}`. `notRef` (`not: { pattern: "^tapestry:" }`) names its `not`. `either` (an `anyOf` of `maxLength: 10` and `pattern: "^nostr:"`) is named by the `anyOf`, and neither branch's keyword is called its own. | red |
| **EN19**, widened | enumerate | Item 2: its seven refusals still name their keyword. They are `enum`, `const`, `pattern`, `maxLength` and `minLength`, and the items' `enum` and `maxLength`, those two with the word `items`. | passes today; kept |
| **EV7**, widened | rule | Item 3. Project's superset links `pastProjects`, a list whose items' type is `["string", "null"]`. `[null]` and `[null, <Loom's reference>]` give no finding. `[null, "A Name"]` gives one, whose `values` is `["A Name"]` alone and whose message doesn't mention null. | red |
| **CE51**, widened | create-element | Item 3 on the write path: `pastProjects: [null, <Loom's reference>]` is made, kept as given. | red |
| **EN14**, widened | enumerate | The review's first probe (Decisions 2 and 12): before the lock on bot's header, the transaction reads only what steps 1 and 2 read. | guard |
| **UE17**, widened | unenumerate | The second probe (Decisions 5 and 12): the same for unenumerate, which reads the links after the lock. | guard |
| **EV17**, new | rule | The third probe (Decision 7), and the edge case above. The flagship set links bot's `flag`. Then `{ flag: "not a reference at all", project: "Loom" }` gives one finding, for `project` alone. | guard |
| **CE54**, new | create-element | The fourth probe (Decision 8, "right after"): `{ project: 5 }` is refused 400 `invalid-fields` by `element-fits-schema`, naming `bot.project`, not `value-not-allowed`. | guard |
| **EN20**, widened | enumerate | Deviation 1. `twice` is linked from project's superset and from the flagship set. Enumerated with project as its source, it is refused `enumerated-elsewhere` at its declared 409, naming the set and `graph unenumerate`, and both links stay. | guard |
| **EN4**, widened | enumerate | Deviation 3: linking `projects` reports four entries, not only the field just linked. They are Grok Four's `projects` and the three elements whose `project` A's link doesn't allow. | guard |

Each assertion carries a one-line comment naming the finding or Deviation it pins.

**The yardstick (EN14, UE17).** The review's probes allowed two reads by their Cypher, and these cases don't. Each suite runs one more call alone, on a copy of the graph its committed call started from: an enumerate, or an unenumerate, of `EG.NOBODY`, a key that names no node. Decision 2 refuses that call `unknown-property` at step 2. So its one transaction reads steps 1 and 2 and writes nothing. The committed call's reads before its lock must be those reads, in order. Moving `P.load` or the links before the lock adds a read there.

**What the seed and the runs gained.**
- `BOT_FIELDS` (`test/helpers/enumerationGraph.js`) gains nine fields at its end, and set-schema makes each one's property node: `pair`, `uniquePair`, `tenThousand`, `overTenThousand`, `closed`, `notRef`, `either`, `pastProjects` and `twice`.
- `prepareLinked` links project's superset to `pastProjects`. The rule's suite and the three element writes' suites use it.
- The enumerate suite links `twice` from project's superset and from the flagship set before A.
  - B gains `pair`, `unique-pair`, `ten-thousand` and `elsewhere-both`.
  - R gains `r-over-ten-thousand`, `r-closed`, `r-not` and `r-either`.
  - `elsewhere-both` is a refusal, but it runs in B, beside the repeats it must not be taken for. So with Deviation 1 reversed, EN22's refusal run still holds refusals only. `refusedAsDeclared` takes the run as a third argument, for it.
- The rule suite links the flagship set to bot's `flag`, and gains the cases `nullItem`, `nullItemRef`, `nullItemName` and `setStart`.
- create-element's refused run gains `both`, and its made run gains `null-item-ok`.

**The seed change alone moves nothing.** With only the seed changed, the six suites that use it gave the same counts as at HEAD, all passing: enumerate 29, unenumerate 17, the rule's 16, create-element 38, update-node 46, add-to-concept 60.

**How loosely the words are pinned.** The Implementer writes the words. The cases pin only these:
- **EN30:** `minItems` as a word, and `10,000` or `10000`.
- **EN31:**
  - for `closed`: `maxItems`, `{"maxItems": null}` with any spacing, and `update-property`;
  - for the `not`: "its not", or `not` quoted as JSON (`"not"`) or as code. The bare word is in most English sentences;
  - for the `anyOf`: the word `anyOf`, and no "its maxLength" or "its pattern".
- **EN19:** the keyword as a whole word, so that `graph enumerate` doesn't count as `enum`, and `items` for the items' two.
- **EV7:** the finding's message doesn't hold `null` as a word, in any case.

### Verification at HEAD

Each suite alone, stack-free, with `zsh tmp/review-19/run-suites.sh <suite>` (it sources `tmp/a10-19-test-design/env.sh`). This ran at `8df52fe5`, with this round's tests uncommitted beside it:

```
enumerate.test.js                     {"pass":29,"fail":2,"skipped":0}   EN30, EN31
unenumerate.test.js                   {"pass":17,"fail":0,"skipped":0}
rules/enumerated-value-allowed        {"pass":16,"fail":1,"skipped":0}   EV7
create-element.test.js                {"pass":38,"fail":1,"skipped":0}   CE51
update-node.test.js                   {"pass":46,"fail":0,"skipped":0}
add-to-concept.test.js                {"pass":60,"fail":0,"skipped":0}
enumerate-agent-through-cli.test.js   {"pass":1,"fail":0,"skipped":0}
```

Before this round's tests, the same suites passed 29, 17, 16, 38, 46, 60 and 1, with none failing.

The four failures, each because Amendment 2 isn't built yet (keys and messages shortened):

```
  FAIL  EN30 [AC6, Decision 4, Amendment 2 item 1]: a list is tried with as many references as it must hold: …
        pair must answer 200; got 409 {"success":false,"error":"The property …, bot.pair in bot (…), has a schema that would refuse every reference: its schema leaves no tapestry:<tapestryKey> value it allows (a reference is 45 characters: …). … Nothing changed.","code":"refuses-references","input":"property"}
  FAIL  EN31 [AC6, Decision 4, Amendment 2 item 2]: refuses-references names what refuses, read from the check: …
        a list with maxItems 0: names maxItems, and '{"maxItems": null}' with graph update-property to take it out; got The property …, bot.closed in bot (…), has a schema that would refuse every reference: its schema leaves no tapestry:<tapestryKey> value it allows …
  FAIL  EV7 [Decision 6, Amendment 2 item 3]: a null, as a field's value or as an item of a list, and a field left out, aren't judged; …
        nullItem: no finding; got [{"index":0,…,"code":"value-not-allowed","field":"bot.pastProjects","values":[null],…,"message":"bot.pastProjects holds a value its link doesn't allow: null isn't a reference: …"}]
  FAIL  CE51 [story 19 AC2, AC3]: allowed references are made, each kept as given; a null, a null in a list beside an allowed reference, …
        null-item-ok is made; got 400 {"success":false,"error":"bot.pastProjects holds a value its link doesn't allow: null isn't a reference: …
```

EN30 and EN31 stop at their first part, but their other parts fail today too. A probe of `_enumerations.js` called `acceptsReference` and `say.refusesReferences` on each new piece. It refused `uniquePair` and `tenThousand`, and its words named nothing for `overTenThousand`, `notRef` or `either`.

### Each guard on its break

`tmp/a10-19-round1-tests/run-breaks.js` makes a `git archive` copy of HEAD (`tree-breaks`) and lays this round's five test files over it. It runs the seven suites there for a baseline, which is the table above. Then it takes each break alone, the reviewer's own from `tmp/review-19/breaks.js` unchanged, and runs its suites. It compares each test with the baseline and puts the file back.

Each break turned its guard red and changed no other test:

| Break | What it does | Result, passed/failed with the baseline's red cases |
|---|---|---|
| B12 | `P.load` before the lock (`enumerate.js:86–89`) | enumerate 28/3: EN14, naming load's read of the concept before the lock |
| B26 | the links read before the lock (`unenumerate.js:86`) | unenumerate 16/1: UE17, naming the links' read |
| B37 | rule 10 before rule 4 (`create-element.js:164–165`) | create-element 37/2: CE54, refused `value-not-allowed` |
| B44 | rule 10 reads a link from any start (`_enumerations.js:121`) | rule 15/2: EV17, with a finding for `bot.flag`. Enumerate, create-element, update-node and add-to-concept as the baseline |
| B16 | a repeat wins over elsewhere (`enumerate.js:106`; Deviation 1 reversed) | enumerate 28/3: EN20, answered `already-enumerated` |
| B45 | the values report judges only the field just linked (`enumerate.js:128`; Deviation 3 reversed) | enumerate 28/3: EN4, with one entry, Grok Four's |

### The red cases pass once Amendment 2 is built

A throwaway sketch of items 1 to 3 ran on a second copy (`tree-fix`). It touched `_enumerations.js` alone (`tmp/a10-19-round1-tests/sim-fix.js`) and never entered the repository.
- **Item 1:** a list is tried with `max(1, minItems)` different references, and one whose `minItems` is above 10,000 is refused in words of its own.
- **Item 2:** the keywords come from ajv's errors on that sample, by the first segment of each error's schema path, and the items' by the second.
- **Item 3:** a list's `null` items are dropped before judging.

On it every suite passes: enumerate 31/0, unenumerate 17/0, the rule's 17/0, create-element 39/0, update-node 46/0, add-to-concept 60/0 and the agent's 1/0.

**The red cases catch wrong fixes.** Each of these ran alone over the sketch:

| Wrong fix | Fails |
|---|---|
| W1: a list tried with one reference repeated, which `uniqueItems` refuses | EN30 |
| W2: at most 9,999 references tried | EN30, as `tenThousand` is refused |
| W3: no cap, so `minItems: 10001` is tried in full and linked | EN30, and EN22, since the refusal run then changes the graph |
| W4: a combinator's inner keywords named as the piece's own | EN31 |
| W5: a list holding a `null` skipped whole | EV7 |
| W6: the items' keywords dropped from the words | EN19 |

### Not pinned: readings of Amendment 2 left to the Implementer or the Architect

- **A piece that doesn't compile alone,** which is to be refused "in words that say it doesn't compile, and why". The property writes compile the whole schema. The only such piece I can see is one whose `$ref` names the schema's own `$defs`, and I didn't probe whether set-schema keeps them.
- **A keyword that fails under `then` or `contains`.** ajv reports a failing `if`/`then` under `#/then/…` and `#/if`, and a `contains` under `#/contains/…` and `#/contains`. Neither `then` nor `contains` is among the five that name a keyword by the outermost. So `if` might be named alone, or with `then`. And a `contains`'s `pattern` might be named as the `contains` or as a `pattern`.
- **`oneOf` and `allOf`,** which are named like `anyOf` but not tried here.
- **The way the words give to take out a `minItems` above 10,000.**
- **A `null` in a list whose items' type doesn't allow one.** Rule 4 refuses it first, as CE54 pins the order, so rule 10 never meets it. Item 3 settles raised point 6 above.
