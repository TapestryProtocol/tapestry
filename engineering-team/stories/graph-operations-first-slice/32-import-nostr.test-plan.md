# Test Plan: Story 32 — `import nostr`

**Story:** `engineering-team/stories/graph-operations-first-slice/32-import-nostr.md` (as amended at Architecture)
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md` (accepted: Option A, with the six story amendments; amended at Test Design, 2026-11-20: a crowded second only on evidence, and uppercase hex refused)
**Date:** 2026-11-20

Every suite but one is stack-free:
- the operation suites run the real catalog in a child process (`test/helpers/operationsHarness.js`) over a graph kept in a file, every statement run by a Cypher engine with Neo4j's uniqueness rules (`test/helpers/cypherEngine.js`, through `test/helpers/cypherGraphFake.js`), and with fake relays and a fake DNS (`test/helpers/relayFake.js`), every service endpoint dead and the harness's spy on everything that signs or reads a key;
- the agent suite runs the real catalog behind `test/helpers/externalCliServer.js`, the agent being `clients/cli/bin/tapestry.js` with an admin's own key;
- `nostr-live.test.js` runs on a scratch stack's Neo4j and relay, and skips, saying so, unless `TAPESTRY_CONTAINER` names a `tapestry-scratch…` container. With the variable unset or naming anything else it asks docker nothing.

All live under `test/operations/import/`, where `test/operations.test.js` finds and runs them, so none needs a line in `test/registry.js`. The declaration-level suites (the listing, `/docs` and openapi-coverage, the route table, both CLIs) read the catalog themselves, so import nostr joins them once declared. No existing test changes: `relationship-type-allowed.test.js` already names `import nostr` as what makes the `nostr` types.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: by id or address | **IR1** a regular event: one node, `NostrEvent` and `TapestryNode` with a key, its `uuid` its id; `id`, `kind`, `pubkey`, `created_at`; no `aTag`, no content; the answer's `ref`, `id`, `outcome`, `node`; `source`, `relay`, `counts` (all nine), `graphs`, `crowded`, `next`, `changes`. **IR2** keys and labels by kind (below). **IR3** `note`, `nevent`, `naddr`; `ref` as asked; a relay hint not followed. **IR4** `name` and `tapestryValue`. **IR14** the change entry: `import nostr`, the caller's; `event-recorded` naming the node; its keys name the placeholders made and the claims' other ends; `graph history` finds it by each, and by the admin. **IN12** the owner's, an admin's and a direct-local caller's entries are theirs; nothing signed, published or read from a key store, no strfry child. **IO9** a node today's builder made for the same event is that node, its key kept. **IR15** `invalid`, `not-found`; **IL6** `unread`; **IO11** `failed` | `nostr-record.test.js`, `nostr.test.js`, `nostr-order.test.js`, `nostr-relay.test.js` | integration (fake) |
| AC2: one graph from one event | **IR5** the author's person node `AUTHORS` it, one per pubkey, an existing one keeping its key. **IR6** a tag node each: `<id>_<index>`, `type`, `value`–`value4`, keyed, `HAS_TAG`. **IR7** `e` and `a` `REFERENCES`; one placeholder by id or by address; a node with no event at the address is the target. **IR8** `b`: `REFERENCES {source: 'b-tag'}`, `INHERITS_FROM`, nothing for the sentinel or a malformed value, a placeholder by id. **IR9** `z`: `HAS_ELEMENT` from the concept's superset; nothing (and no placeholder) for a concept not held, or `word`. **IR10** `n` and `s` only within the claimant's graph. **IR11** relationship letters: allowed types between her own nodes by address (editorial and firmware's non-nostr), none for nostr or undeclared types, another author's end, an end named by id; a placeholder for her own end not yet held. **IR12** role labels. **IR13** recorded, never judged. **IG7** a graph's relationships are its author's. **IW5**, **IW6** the instance's own nodes. **IO10** the same graph whatever the order | `nostr-record.test.js`, `nostr-graph.test.js`, `nostr-own.test.js`, `nostr-order.test.js` | integration (fake) |
| AC3: safe to repeat, any order, by version | **IO1** a repeat: `unchanged`, no entry, the graph as it was. **IO2** memo #130: referrer by `e`, then its addressable target: one node, the reference on it, the placeholder's key kept, `placeholder-filled`. **IO3** the `e`-plus-`a` referrer: one node, both references, `placeholder-merged`. **IO4** a `b` by id, addressable and regular. **IO5** each claim's other end second: `z`, `n`, `s`, a relationship letter's ends, a graph element's nodes. **IO6** one placeholder for two referrers, filled once; by id the same. **IO7** a newer version (below). **IO8** `older`, nothing written; the lower id stands on a tie. **IO10** three orders, one graph, no `failed`. **IO11** a placeholder made meanwhile (another import's) is met by a second run. **IG6** a graph again: `unchanged`. **IG10** `z` wired when a graph brings `IS_THE_CONCEPT_FOR`. **LV1–LV3** on Neo4j | `nostr-order.test.js`, `nostr-graph.test.js`, `nostr-live.test.js` | integration (fake); live |
| AC4: a graph | **IG1** a concept graph by its address: the element, its nodes, the graphs it imports and theirs, each letter once, at alice's addresses as her letters; the eight relationships its graphs list; role labels; a `ListHeader` and no `ConceptHeader`. **IG2** `source: 'graph'`; each graph with its depth and `followed`; each letter's outcome. **IG3** slugs through a graph followed before; one no graph lists makes nothing. **IG4** depth four, the rest under `next.graphs`; `not-found`; `unreadable` with its letter recorded. **IG5** 50 graphs, the rest under `next.graphs`, each named once. **IG8** a graph the relay doesn't hold: 200, `not-found`. **IG9** the class thread isn't followed. **XI1** the agent's run | `nostr-graph.test.js`, `nostr-agent-through-cli.test.js` | integration (fake) |
| AC5: by filter | **IF1** thirteen events, five a request: all recorded, paged by `until`, one request at a time, one connection, pages of 500. **IF2** a cut second swept with `since = until`. **IF3** a crowded second, once the relay is seen to stop short (a newer second leaves the sweep two more to find; older letters found by the next page), split by kinds, then by authors, each part asked alone; one that can't be split under `crowded` with its second and count, judged once the next page is read, the answer saying a narrower filter may read the rest. **IF4** the filter's `limit` as the cap: the second finished, `next.until` the second before; three calls read it all; a repeat records nothing. **IF5** `since`. **IF6** JSON text; `search` as given on every request; `#z` passed. **IF7** the newest version of an address. **IF8** no false alarm on a relay that answers what it is asked: one event, and eight letters in one second, read whole, nothing crowded. **XI1**, **LV4** two calls | `nostr-filter.test.js`, `nostr-agent-through-cli.test.js`, `nostr-live.test.js` | integration (fake); live |
| AC6: own nodes stay | **IW1** the assistant's letter for its own node: `own`, nothing changes, no entry. **IW2** a newer one, as export nostr sends: `own`, the node keeps the older letter, nothing holds the newer id. **IW3** a letter at a node made here with no letter: `own`, still event-less. **IW4** the owner's letter at the owner's node: `own`. **IW5** an own letter with no node is recorded: its `z` and `n` made, its `s` and relationship letter not; one at a placeholder fills it. **IW6** another author's claims on own nodes: `z` made, `n`, `s`, relationship letters and graph relationships not, `e`/`a`/`b` references made; every own node's labels, properties and relationships as they were but for those. **IW7** `graph set-schema` on beagle answers as before her claims were imported; `graph list-elements` from the owner's point of view leaves her element out, `pov=everyone` counts it | `nostr-own.test.js` | integration (fake) |
| AC7: refusals, and agents | the refusals (table below), each with its status and in words naming the input; **IN10** the refusal run changed nothing and recorded no entry, each call refused. **IN11** visitor 401, stranger 403, 415, unknown input, sizes. **IN1** the declaration. **IN2** listed with every refusal; `/docs` has the POST. **IN13** the internal command, `local`; its refusal the route's. **IN14** catalog §5, BIBLE §6 and §11, the skill's line. **IL5** unreachable, told apart from a relay holding nothing. **XI1** the agent's whole sequence. **LV5** | `nostr.test.js`, `nostr-relay.test.js`, `nostr-agent-through-cli.test.js`, `nostr-live.test.js` | integration (fake); live |

### The ADR's decisions

| Decision | Tests |
|---|---|
| 1 the declaration and its refusals | IN1, IN3–IN11, IL5 |
| 2 the reading | IL1–IL7, IR3 (hints), IF1 (one connection, one request at a time) |
| 3 checking each event | IR15, IF7 |
| 4 keys and versions | IR1, IR2, IO8, IO9 |
| 5 a filter, paged (as amended: full only on evidence) | IF1–IF6, IF8 |
| 6 a graph, followed | IG1–IG10 |
| 7 the recorder | IR1–IR7, IR14, IO2–IO4, IO7, IO9, IO11, IW1–IW5 |
| 8 the claims | IR7–IR11, IR13, IO5, IO7, IG7, IG10, IW5, IW6 |
| 9 role labels | IR12, IG1, IO7 (never taken out) |
| 10 `run`, not the write path | IN1 |
| 11 the answer | IR1, IG2, IF1, IF3, IF4 |
| 12 caps and time | IN4 (200), IG4 (four levels), IG5 (50 graphs), IF4 (the filter's limit), LV6 (timing) |
| 13 two at once | IO11 (the fake), LV3 (Neo4j) |

### Keys and labels by kind (IR2)

| Event | Its node |
|---|---|
| kind 1 | at its id, no `aTag` |
| 39999, `d` given | `39999:<pubkey>:<d>`, `aTag`, `ListItem` |
| 39998 | `ListHeader`, never `ConceptHeader` |
| 30023 with `['d', '']`; 30024 with no `d` | `<kind>:<pubkey>:` |
| 0 and 10000, asked by address | `<kind>:<pubkey>:`, `aTag` |
| 40001 with a `d` tag | at its id, no `aTag` |
| 9998, 9999 | at the id, `ListHeader`, `ListItem` |
| 7 | `Reaction`, its content kept |

### A newer version (IO7)

v1 claims `z` dog (the assistant's), `z` cat (alice's), `n` and `s` naming her own set and superset, `b` and `e` to bob's; its word types hold `set`. Between imports the test adds, as the graph operations leave them, dog's section in `tapestryOwnSections` and a `CITES` to the assistant's Rex; her relationship letter claims v1 `SUPERCEDES` her set. v2 has one `t` tag. After v2: `updated`; the same node and key, v2's id and `created_at`; no `name` or `tapestryValue`; v2's tags only, v1's tag nodes gone; the `z` on cat, the `n`, the `s` and the `b` gone; the `e` tag's reference gone with its tag; dog's `HAS_ELEMENT` and section kept; `CITES` kept; `SUPERCEDES` kept; `Set` kept; `event-updated` with `was` and `now`, its keys naming the four nodes whose relationships it took out. v1 again: `older`.

### The refusals

| Code (status) | Test | Cases |
|---|---|---|
| `no-source` (400) | IN3 | `{}`; `relay` alone. Names the four ways in |
| `two-sources` (400) | IN3 | ids and graph, addresses and filter, graph and filter, ids and filter; each names the two. Ids with addresses is one source (W's `w-both`) |
| `too-many` (400) | IN4 | 150 ids and 51 addresses; names 200, ids and addresses. 201 ids alone and `ids: []`: 400 naming ids |
| `bad-id` (400) | IN5 | not hex, 63 characters, uppercase hex (refused, never lowered), a `note` and an `nevent` that don't decode, an `npub`. Names the value |
| `bad-address` (400) | IN6 | a kind that isn't one, kind 70000, a pubkey of three characters, an uppercase-hex pubkey, no d part, an `naddr` that doesn't decode (each named); an id as `graph` |
| `bad-filter` (400) | IN7 | JSON that doesn't parse; `foo`; `kinds: "1"`; `#ab`; `since: "yesterday"`. Names what it couldn't take |
| `bad-relay` (400) | IN8 | `https://`, `http://`, a user name, `wss://`, no scheme |
| `private-relay` (403) | IN9, XI1, LV5 | the own relay named, `localhost`, `10.0.0.5`, `[::1]`, names resolving to private, to public and private, to nothing; the owner, an admin, a direct-local caller and the command. No connection made; the guard asked the DNS for each name |
| `relay-unreachable` (409) | IL5 | refuses both tries (two connects); its first request never ends. A relay holding nothing: 200, `not-found` |
| built-ins (400, 401, 403, 415) | IN11 | unknown input; a filter's text past 10,000; a relay past 2,000; ids not a list; visitor, stranger, `text/plain` |

## Edge cases

- [x] Empty input (IN3), and an empty list (IN4).
- [x] Concurrent calls: another import's placeholder committed between this one's reads and its write (IO11); two at once on Neo4j (LV3).
- [x] Graph database unavailable: 500, keeping what it recorded (IO11).
- [x] A handle not found: ids, addresses and graphs the relay doesn't hold (IR15, IG4, IG8, IL5).
- [x] An event the request didn't ask for (IR15); one that doesn't verify by its id, its signature, or its shape (IR15).
- [x] The same id twice in one call (IR15); two versions of one address on the relay, by address (IR15) and by filter (IF7).
- [x] A placeholder made by the import is never "own", even at the assistant's address (IW5).
- [x] An `a` to an address a node with no event holds: that node, never a second (IR7).
- [x] A relay that answers events then never ends (IL5's first request, IL6's second) or closes a request (IL6).
- [x] A tie of `created_at` both ways (IO8).
- [x] A crowded second's alarm needs evidence: a relay seen to stop short (IF3), and none on a relay that answers what it is asked (IF8).
- [ ] Not tested: Decision 5's "What it can miss", a relay that quietly answers fewer than 500 for a filter whose every match is in one second, which never shows it stops short.
- [x] A replaceable event's node today's builder keyed by id: moved, unless a node holds the address (IO9).

**Not pinned on purpose:**
- The words of each refusal beyond what it must name.
- The name of the field that names a graph in `graphs`, and of the fields in a `crowded` entry: each is found by its values.
- `address` of a regular event in `events` (its node's `uuid` is its id).
- Whether an older version listed in the same call as its address's newest appears in `events` at all (IR15, IF7 accept either).
- Whether the change entry's `nodes` names the person node and the tag nodes; it names the placeholders and the other ends of references, memberships and structure claims (IR14, IO7).
- Which transaction makes a graph's `relationships`, so long as the graph ends wired (IG1, IG10).
- How a request's limit relates to a filter's own `limit` (IF4 holds either way); pages carry `limit: 500` when the filter gives none (IF1).
- The Cypher's text: any statement within the engine's subset runs (below).

## Test infrastructure

- **Runner:** each suite exports `run()`; `test/operations.test.js` discovers them.
- **The recorder's Cypher runs on a Cypher engine, not on pinned shapes.** `test/helpers/cypherEngine.js` (new) runs reads *and* writes, as Neo4j 5 would, within a subset: `MATCH`/`OPTIONAL MATCH`/`WHERE`/`WITH`/`UNWIND`/`RETURN`; `CREATE`; `MERGE` of a node or a path with `ON CREATE SET`/`ON MATCH SET`; `SET` (`v.p =`, `+=`, `=`, labels); `REMOVE`; `DELETE`/`DETACH DELETE`; `FOREACH` (nested, so `keyNode` runs); label alternatives in patterns; relationship property maps; maps, arithmetic, `CASE` (both forms), list and pattern comprehensions, `EXISTS { }` and `COUNT { }`, and the functions its header lists. It keeps Tapestry's five uniqueness rules (`NostrEvent.id`, `NostrEvent.uuid`, `NostrEventTag.uuid`, `NostrUser.pubkey`, `TapestryNode.tapestryKey`), failing a breach with Neo4j's code and message; rolls a failed statement back; refuses a null in a `MERGE` map and a relationship from a null node; stores only what Neo4j can. Outside the subset (APOC and other procedures, `CALL { }`, `UNION`, path variables, a label alternative in `CREATE`/`MERGE`, map projections) it says "the fake graph can't run this Cypher (…)", naming what it met. **Why:** the ADR leaves the recorder ten statements whose correctness is Neo4j's behaviour (a `MERGE` under the uniqueness rules, a placeholder unless held, `DELETE` against `DETACH DELETE`); pinned shapes would fix the Implementer's text and still not show the uniqueness failure behind memo #130. On this engine today's `buildImportCypher` runs whole (it seeds "a node today's builder made"), and memo #130's failure happens on it exactly as on Neo4j (**CE4**). **No statement shape is pinned**; the Implementer's must stay inside the subset.
- **The seam's fake,** `test/helpers/cypherGraphFake.js` (new): `writeTransaction` runs work over a copy, saved only on success; a failed statement fails the transaction and every later statement in it, as Neo4j's does; the commit refuses a relationship a `DELETE` left without its node. Its failures: `unreachable: { after }` (rejects as neo4j-driver does, code `ServiceUnavailable`, after that many commits); `failWrite` (a write whose parameters hold a string fails, `times`, with a code, default `ConstraintValidationFailed`); `meanwhile` (another transaction commits nodes just before the first write naming a string: IO11's race). A statement outside the engine's subset (graph search's `CALL`, `SHOW FULLTEXT INDEXES`) goes to `graphFake.js`'s exec. Other operations whose own suites run on `graphFake.js` (`graph history`, `set-schema`, `list-elements`) are run here over the import's graph the same way, in a harness run of their own (`readWith`).
- **The engine's own suite,** `test/operations/import/cypher-engine.test.js` (**CE1–CE11**), passes now: it tests the fake, not the feature.
- **The relay seam.** `src/operations/catalog/import/_relay.js` must export an object whose `connect(url)` it calls through that object at each connection, as `src/operations/graph.js`'s methods are called; the harness assigns it. `connect` resolves an object with nostr-tools' `subscribe(filters, { onevent, oneose, onclose })` → `{ close() }`, `close()`, and `publish()` (logged if ever called). The fake relays (`test/helpers/relayFake.js`, new) answer from fixture events, newest first and the lower id first on a tie, with a per-request `cap`, `noEose`, `close`, `extra` (sent unasked) and connect modes `refuse`, `fail-once`, `hang`; each connection, request, end, close, publish and DNS question goes to a log the suites read. Events arrive in one burst, after the request returns.
- **The DNS.** The harness replaces `dns.promises.Resolver` before the catalog loads; the relay host guard takes it when given no `Resolver`. The code must give the guard no resolver of its own captured some other way.
- **Keys.** The callers are `graphOpsSuite.js`'s fixed fake keys. The import verifies every signature and those keys have no secret, so letters are signed with throwaway keys from fixed seeds (`KEYS` in `test/helpers/importFixtures.js`): `ta` (the child's `TA_PUBKEY`, which the code still finds at run time through `getOwnerAssistantPubkey`), `alice`, `bob`, `carol`, and `ownerSigner` (IW4's owner, the only case that needs the owner's letter). IW7 keeps graphOpsSuite's TA, over `propertyGraph.js`'s seed.
- **The harness hooks** (additive): `operationsHarness.js` takes `graphFake: { stateFile, engine: 'cypher' }` and `relayFake: { file }`; `externalCliServer.js` takes `graphFakeEngine: 'cypher'` and `relayFake`. A missing `_relay.js`, or one with no `connect`, stops the run with that reason.
- **Fixtures** (`test/helpers/importFixtures.js`, new): a concept as an instance publishes it (eight letters, its graphs as today's create-concept writes them), relationship and graph letters, forged ones; the assistant's concept as today's routes leave it (its letters imported by today's builder, role labels and wiring added after, a set, an element and a node made here with no letter); a runner; readers; and `canonical`, which compares two graphs without keys or entries (IO1, IO10).
- **What the Implementer also meets:** `tapestry-key-paths.test.js` scans every `CREATE`/`MERGE` node in `src/` for `keyNode`, and its G19 refuses a scan of `z` tags that ends on `:NostrEvent` alone.
- **Firmware state:** none live. The allowed relationship types are firmware's files, read from disk.

## How to run

Each suite alone, with every endpoint dead, `TAPESTRY_CONTAINER_PORT` unset, and stub `curl` (exit 7) and `docker` (exit 1) first on `PATH`:

```
BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9 \
NEO4J_URI=bolt://127.0.0.1:9 REDIS_HOST=127.0.0.1 REDIS_PORT=9 TAPESTRY_CONTAINER=no-such-container \
node -e "require('./test/operations/import/nostr.test.js').run().then(r => console.log(JSON.stringify({pass:r.pass,fail:r.fail,skipped:r.skipped})))"
```

The same for `nostr-record`, `nostr-order`, `nostr-own`, `nostr-graph`, `nostr-filter`, `nostr-relay` (about 20 s: two cases wait out Decision 2's ten seconds), `nostr-agent-through-cli`, `nostr-live` (skips) and `cypher-engine`. Never run `test/operations.test.js` beside the suites it runs, and never the full `npm test` on the Mac Studio, whose stack is the agent-memory instance. The pull request's CI runs the full gate. The live suite runs with `TAPESTRY_CONTAINER=tapestry-scratch-…` on a stack from `scripts/scratch-stack.sh`.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

Automated in `nostr-live.test.js`, which publishes with fresh throwaway keys to the container's relay from a node process inside it:
- **LV1** memo #130's pair on Neo4j; **LV2** the `e`-plus-`a` referrer; **LV3** two imports of one new event fired together from one process in the container: one node; **LV4** a two-call filter; **LV5** a private relay; **LV6** 300 letters by filter, events a second printed for the story's evidence against Decision 12's caps and nginx's 60 s.

By hand, in the story's record:
- **LH1** XI1's sequence through the external CLI, by an admin agent with its own key and no change to the CLI, reading one concept's concept graph from a hosted instance's public relay (AC7).
- **LH2** a call through nginx that reads up to Decision 12's caps finishes inside 60 s.
- **LH3** across the run, the instance's own relay holds no letter the import read from an outside relay (Option C), and the stream consumer wrote no follows from it.

## Raised at test design, and how each was settled

Settled by the owner on 2026-11-20, with ADR 0032's Test Design amendment (`3c5449b2`) and the story's "Changed at Test Design" note.

1. **One answer per address, or one per version?** AC1 gives "for each id and address asked for, once" its outcome; Decision 3 makes the other versions in a call `older`, and Decision 11 lists "each event". *Settled: as the ADR says.* IR15 and IF7 accept both: exactly one recorded entry for the address, any other entry `older` with the older id.
2. **Decision 5's crowded test could fire falsely** for a filter matching one event, or letters in one second. *Settled: a crowded second only on evidence* (Decision 5, "When an answer is full"): a request is full when answered with as many as it asked for, or, once the call has seen the relay stop short, as many as it stopped at; a sweep is judged once the next page has been read. IF3 now gives each case that evidence, and IF8 pins no false alarm.
3. **201 ids alone** is `invalid-input` by the schema's 200 before `run`. *Settled: as the ADR says.* IN4 accepts either code alone and pins `too-many` together.
4. **Uppercase hex.** *Settled: refused, never lowered* (Decision 1): `bad-id` for an id, `bad-address` for an address's pubkey. IN5 and IN6 pin both.
5. **A filled placeholder's outcome.** *Settled: as the tests have it:* `recorded`, with the change `placeholder-filled` (Decision 7.8).
6. **"Nothing read yet":** an unfinished request's events count as unread (Decision 2). *Settled: as the ADR says;* IL5 and IL6 pin it.
7. **The 40 s budgets and the 1,000-event cap** can't be reached stack-free in reasonable time. *Settled: as the plan has it;* LV6 measures them on a scratch stack.
8. **Catalog §5 says "the instance's own pipelines also call `import nostr`"**; none does yet. *Settled:* the Implementer corrects that line with the stream-consumer sentence. IN14 doesn't pin it.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-20, on `A10.32-import-nostr` at `3c5449b2` (staging `1abd2889` with the story, the ADR and its Test Design amendment), with this phase's files uncommitted beside it, each suite alone with every endpoint dead and the stubs first on `PATH`:

```
nostr.test.js                     {"pass":0,"fail":14,"skipped":0}
nostr-record.test.js              {"pass":0,"fail":15,"skipped":0}
nostr-order.test.js               {"pass":0,"fail":11,"skipped":0}
nostr-own.test.js                 {"pass":0,"fail":7,"skipped":0}
nostr-graph.test.js               {"pass":0,"fail":10,"skipped":0}
nostr-filter.test.js              {"pass":0,"fail":8,"skipped":0}
nostr-relay.test.js               {"pass":0,"fail":7,"skipped":0}
nostr-agent-through-cli.test.js   {"pass":0,"fail":1,"skipped":0}
nostr-live.test.js                {"pass":0,"fail":0,"skipped":6}
cypher-engine.test.js             {"pass":11,"fail":0,"skipped":0}   the fake's own suite
```

All 73 failures give the same reason; a line of each kind:

```
  FAIL  IN1 [Decisions 1 and 10]: the declaration: a write for the owner and admins with run, five optional inputs, nine refusals of its own
        src/operations/catalog/import/nostr.js does not exist yet (ADR graph-operations-first-slice/0032 Decision 1)
  FAIL  IR1 [AC1, Decision 4]: a regular event is one node, NostrEvent and TapestryNode with a key, at its id; the answer names it
        src/operations/catalog/import/nostr.js does not exist yet (ADR graph-operations-first-slice/0032 Decision 1)
  FAIL  IO2 [AC3, memo #130]: a referrer by e before its addressable target, then the target: one node, the reference on it
        src/operations/catalog/import/nostr.js does not exist yet (ADR graph-operations-first-slice/0032 Decision 1)
  FAIL  IF8 [AC5, Decision 5 as amended]: no false alarm: on a relay that answers what it is asked, one event, or eight letters in one second, are read whole and nothing is crowded
        src/operations/catalog/import/nostr.js does not exist yet (ADR graph-operations-first-slice/0032 Decision 1)
  FAIL  XI1 [AC7]: the agent imports a concept graph, repeats it, imports a referrer before its target and a filter in two calls, and is refused a private relay
        src/operations/catalog/import/nostr.js does not exist yet (ADR graph-operations-first-slice/0032 Decision 1)
  (import nostr's live checks skip: TAPESTRY_CONTAINER is 'no-such-container', not a scratch container (its name must start with tapestry-scratch). …)
  SKIP  LV1 [AC3, memo #130]: on Neo4j, a referrer by e before its addressable target makes one node, the reference on it
```

**Each test gets past its declaration check.** A copy of the tree in the session's scratchpad ran the final suites against a throwaway stub of the operation (ids and addresses, the guard, the relay seam with batching and a retry, a MERGE recorder with tags, author, `e`/`a` references and placeholders, the own test, versions and entries; no filters, graphs or other claims). 21 passed where the stub does what the test asks (IN1 IN2 IN5 IN11 IN12 IN13 IR4 IR5 IR6 IR7 IR14 IO6 IO8 IW1 IW2 IW3 IW4 IL1 IL2 IL4 IL7), 52 failed on what it leaves out, and none crashed (the two suites this amendment changed were run again so). The engine caught the stub's naive `MERGE` on memo #130's `e`-plus-`a` case with Neo4j's own words (IO3: `Node(163) already exists with label \`NostrEvent\` and property \`id\` = …`). That run also found four faults in the tests, since fixed: IN11 looked for a code on the auth middleware's 401; IR5 rode on the call carrying the `nip19` refs; IW1 asked by an address that also holds IW2's newer letter; IG9 passed when nothing ran.

**The amended Decision 5 over the fixtures.** A throwaway reading of the amended rule, run in the scratchpad over `relayFake.js`'s own `answer()`, gives what IF1–IF3 and IF8 assert: IF1 13 read, IF2 9, IF3's kinds and authors 10 each and nothing crowded, IF3's crowded case 7 read with `1700300600` crowded at 5, IF8 1 and 8 read with nothing crowded (the relay never seen to stop short). Before the amendment, IF8's two cases would each have been listed crowded.
