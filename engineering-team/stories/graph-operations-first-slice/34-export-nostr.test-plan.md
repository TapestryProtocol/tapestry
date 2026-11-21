# Test Plan: Story 34 — `export nostr`

**Story:** `engineering-team/stories/graph-operations-first-slice/34-export-nostr.md` (as amended at Architecture)
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md` (accepted: Option A, with seven story amendments; its Amendment 1, at Test Design, approved by the owner with this plan, 2026-11-20; its Amendment 2, at Review, approved by the owner, 2026-11-21: see "Review round 1" below)
**Date:** 2026-11-20

Every suite but one is stack-free:
- **The operation suites** run the real catalog in a child process (`test/helpers/operationsHarness.js`) over a graph kept in a file. Every statement runs on the Cypher engine with Neo4j's uniqueness rules (`test/helpers/cypherEngine.js`, through `cypherGraphFake.js`). Relays and DNS are fakes (`test/helpers/relayFake.js`), every service endpoint is dead, and the harness's spy watches everything that signs or reads a key.
- **The agent suite** runs the real catalog behind `test/helpers/externalCliServer.js`. The agent is `clients/cli/bin/tapestry.js`, with an admin's own key.
- **`nostr-live.test.js`** runs on a scratch stack's Neo4j, strfry and control panel. It skips, saying so, unless `TAPESTRY_CONTAINER` names a `tapestry-scratch…` container, and otherwise asks docker nothing.

All live under `test/operations/export/`, where `test/operations.test.js` finds and runs them, so none needs a line in `test/registry.js`. The declaration-level suites (the listing, `/docs` and openapi coverage, the route table, both CLIs) read the catalog themselves, so export nostr joins them once declared. One existing test changes: RE1 in `test/publish-export-a-concept.test.js` widens, as ADR 0034 Decision 11 says (it passes before and after).

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: publish a scope | **ES1** a concept made with the graph operations, exported to the instance's own relay: each letter `new`, signed by the assistant (its signature verifies, its pubkey the child's `TA_PUBKEY`), stored through the `strfry import` seam, read back, `accepted`; each node then holds the letter's `id`, `created_at` and `sentTo: ['own']`, with no `NostrEvent` label added and no tag, label or relationship changed; one change entry, operation `export nostr`, a `letter-sent` change per letter (node, address, kind, `was: null`, `now`, relays), which `graph history` finds by each node. **ES2** scope by `node`, by `graph` (a concept graph, a Tapestry, a selection saved with `graph create-element`) and by `everything`, each bringing what Decision 2 says, and nothing that isn't a letter's (person nodes, tag nodes, placeholders, change entries). **ES3** two outside relays named: one accepts, one refuses with its reason, a third times out, a fourth can't be reached: each answered so; `sentTo` lists `own` and the one that accepted | `nostr-send.test.js` | operation |
| AC2: a letter says what the graph says now | **EL1** each kind of node the graph operations make (header, the seven core nodes, a set, an element, a property) gets its letter from its tags: kind, `d` first, `json` last, the rest by type and value, `content` empty. **EL2** a set's `s` from its parent links: link-set under a second parent and unlink-set from the first give one `s`, the second parent; a superset under another own superset gets an `s`; another author's parent gives none. **EL3** `z` and `n` as the node holds them: an ancestor concept's class thread adds no `z`; a `z` for `word` and a superset's `z` for the superset concept are kept (Context 3). **EL4** the `json` is the stored JSON, read through `tapestry-resolve` when it is an `lmdb:` pointer, `graphContext` taken out, never the LMDB copy when it differs. **EL5** a header's pointer `b` is carried; an element of a concept whose header has pointer or untyped `b` tags gets a `z` stamp for each, an inherit-typed one none, and a stamp it has isn't doubled. **EL6** the round trip: a concept made with the graph operations, with a set and two elements, exported to a fake relay; import nostr records those letters into an empty graph: one node at each address, the same names and JSON less what is local, every relationship among them that a letter carries, and nothing more but a superset's `HAS_ELEMENT` to an element reached through a set. **EL7** a relationship no letter carries (graph enumerate's `ENUMERATES`, graph add-relationship's) is reported `uncarried-relationship`, with its type and two nodes, and no letter is made for it | `nostr-letters.test.js` | operation |
| AC3: links, whole values, references | **ML1–ML9** (the shared helper, `src/lib/markdownLinks.js`): inline links, images, autolinks, reference definitions and the references that use them are found, with their destinations; one in a code span or code block isn't; a rewrite changes only the destination, byte for byte elsewhere; a dropped link keeps its text, an image its alt, a reference its text with its definition taken out, and an autolink becomes the given name or nothing. **EK1** through export: a link to a node with a letter becomes `nostr:naddr1…` (decoded: its kind, pubkey and d-tag); to one sent in the same call, the same; to a node whose address is an event id, `nostr:nevent1…`; to an own node with no letter outside the call, and to a key no node has, its text, each reported `link-dropped` with the node, where and the key. **EK2** a whole value `tapestry:<key>` becomes `nostr:naddr1…`, or is left out and reported `value-left-out`. **EK3** a tag naming an own node with no letter outside the call is reported `unsent-reference`, and the letter still names it. **EK4** after all of it, the node in the graph keeps its `tapestry:` links and values, its tags unchanged. **EK5** an `lmdb:` whole value is resolved before anything else; one the store doesn't hold is left out and reported `pointer-unresolved`; a `json` pointing at nothing makes its node `unbuildable`, reported, its letter not built (AC1's `unbuildable`, added at Test Design: no other test named it). **EK6** a graph listing an address or an id no node holds reports `not-found` | `markdown-links.test.js`, `nostr-links.test.js` | unit, operation |
| AC4: whose nodes it signs | **EL8** in a graph scope: another author's node (an admin's included) is `not-own`; the owner's is `owner-signed`; a node of another kind, the assistant's own kind 1 note, is `other-kind` (an own one, so the test pins no order between the classes); one with no address `no-address`; none is signed or sent, and the letters naming them name them by address. **EL9** a node with no author whose address carries the assistant's key is signed; one with no author and no address isn't | `nostr-letters.test.js` | operation |
| AC5: order, dry run, repeat | **ES4** a dry run: each node's outcome, a `changed` one's added and removed tags, the reports before the letters, and nothing signed (the spy sees no `finalizeEvent`), sent (the relay log shows no publish) or recorded (no entry, no node property changed). **ES5** the same call again with nothing changed: every letter `unchanged`, nothing signed, sent or recorded. **ES6** graph update-node changes one element: a dry run lists only it `changed`; the export signs only it, `created_at` after its last letter's, even when that one is dated ahead of now. **ES7** an `unchanged` letter is sent as it was signed (the same id) to a relay named now that isn't in its `sentTo`; a relay that has it answers `held`; `sentTo` gains the new one. **ES8** order: each letter goes after the call's letters it names; a header and its concept graph, which name each other, go header first. **ES9** paging, with the declaration's `MAX_SEND` and `MAX_SCOPE` shrunk: the call answers `next.after`, the next call given it goes on where the first stopped, and the two together sign each letter once. **ES10** time, with `SEND_CUTOFF_MS` shrunk: letters not sent in time answer `not-sent`, with `next.after` | `nostr-send.test.js` | operation |
| AC6: letters never come back | **EW1** import nostr of the letters export sent: `own`, every node as it was. **EW2** `POST /api/neo4j/event-update` at a node whose letter export sent (strfry answering that letter): `unchanged`, with no import statement run and the node's tags as they were; with an older letter at the address, the same; with a newer one, imported as today. **EW3** the I/O import of a file holding that letter: the item `skipped`, with the reason, no import statement run for it; a newer letter is imported. **EW4** the client-publish route's brain-write hook: export's Tapestry letter posted again isn't imported; a newer one is. **EW5** `holdsLetterOrNewer` itself, over today's own letters: yes for the letter the node holds, an older version, and a tie the node's lower id wins; no for a newer version, a tie the event's lower id wins, another author's node, an own node with no letter, and no node. Its answer is read as `true`/`false`, or `{ holds }` | `nostr-own.test.js` | operation, unit |
| AC7: refusals, and agents | the refusals (table below), each with its status and in words naming the input. **EN1** the refusal run signed nothing, sent nothing and recorded nothing. **EN2** a visitor is refused 401 and a stranger 403; the owner and an admin are answered; the internal command `tapestry export nostr` answers as the route, with no sign-in, its entries naming the command. **EN3** the declaration (a write with `run`, six optional inputs, its eleven refusals, and the seams below), listed for agents, and its `/docs` entry, both from its declaration. **EN15** the catalog's export row, BIBLE §6 and §11 and the skill say what it does, and the skill stops saying no operation publishes or signs (AC7's docs clause, added at Test Design: the plan had no test for it). **EA1** the agent's sequence through the external CLI (below). **RE1** widened, still passing | `nostr.test.js`, `nostr-agent-through-cli.test.js`, `test/publish-export-a-concept.test.js` | operation, agent |

| AC1 (round 1): a graph not followed | **EK7** a graph five levels of imports below the one named, and the 51st graph (one named and its 50 imports), are each sent, their lists unfollowed, and each reported `graph-not-followed` once, naming it; the graphs before them are followed | `nostr-links.test.js` | operation |
| AC1 and Decision 8 (round 1): the record | **ES13** (changed) the letters whose read-back didn't answer are in the call's change entry, each with each relay's answer, and on no node. **ES14** (a pin added) a call whose every letter is unreachable writes no entry. **ES18** (a pin) a record that finds the node holding a newer letter another export sent leaves it, `raced`. **ES19** one that finds an older letter another export sent replaces it: the node keeps the newest | `nostr-send.test.js` | operation |
| AC1 and Decision 6 (round 1): the call's time | **ES17** a `strfry import` that never ends: the call answers within `BUDGET_MS` and 5 s, each letter as the read-back decides, none on its node, none sent out | `nostr-send.test.js` | operation |
| AC2 (round 1): what a `b` tag carries | **EL12** (a pin) a child's `INHERITS_FROM`, carried by its `b` tag, isn't reported `uncarried-relationship`; the link back, which no tag carries, is | `nostr-letters.test.js` | operation |
| AC3 (round 1): a byte-order mark | **ML10** a text that starts with U+FEFF: its inline link, autolink, and definition with its reference found at their offsets and rewritten, every other character kept, the mark too. **EK8** an element's field that starts with the mark has its link rewritten in the letter | `markdown-links.test.js`, `nostr-links.test.js` | unit, operation |
| AC5 (round 1): order by kind first | **ES8** (changed) headers, then supersets, then sets, then the rest; within a kind, after what of that kind it names, a cycle by tapestryKey; pet's header before all its core nodes and elements; a graph after the nodes it lists | `nostr-send.test.js` | operation |
| AC6 (round 1): a letter an export recorded | **EW2** (changed) event-update turns away a newer letter an `export nostr` entry records for the node; on that graph, a newer one no entry records is imported. **EW5** (changed) `holdsLetterOrNewer` answers yes for the first, no for the second | `nostr-own.test.js` | operation, unit |
| AC7 (round 1): the guard test | **RE1** (changed) flags a `.publish(` on a relay a file makes with a relay class or gets from import's `_relay.js`; checks first that it flags export's own `_send.js` by its text; passes on the tree | `test/publish-export-a-concept.test.js` | source sentinel |

### Sending and its classes (Decision 6)

| Case | Instance's own relay | Outside relays | Recorded on the node |
|---|---|---|---|
| **ES11** `strfry import` runs, read back finds it | `accepted` | sent | yes |
| **ES12** read back answers without it | `refused`, "didn't store it" | `not-sent` | no |
| **ES13** read back doesn't answer | `unread` | `not-sent` | no |
| **ES14** `strfry import` can't run | `unreachable`, every letter | `not-sent` | no |
| **ES15** `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` | `accepted` | `not-sent`, saying why | `own` only |
| **ES16** a live relay drops the connection mid-publish | — | `unreachable` or `timeout`; the control panel's process lives on | the rest as answered |
| **ES17** (round 1) `strfry import` never ends | `unread`, `refused` or `unreachable`, within `BUDGET_MS` | `not-sent` | no |

(Round 1, Amendment 2 item 1) An `unread` letter, ES13's and any of ES17's, is recorded in the call's change entry, though on no node; a call whose every letter is refused, unreachable or not sent writes no entry (ES14).

### The refusals (each changes nothing, signs nothing, records no entry)

| Code (status) | Test | Given |
|---|---|---|
| `no-scope` (400) | EN4 | none of `node`, `graph`, `everything` |
| `two-scopes` (400) | EN5 | `node` and `graph`; `graph` and `everything` |
| `bad-ref` (400) | EN6 | an empty ref; one with a control character |
| `unknown-ref` (404) | EN7 | a key no node has; a name nothing has |
| `ambiguous-ref` (409) | EN8 | a name two nodes share, with the candidates |
| `not-a-graph` (400) | EN9 | `graph` naming an element whose JSON holds no `graph` object and that the graph concept's class thread doesn't reach |
| `bad-relay` (400) | EN10 | `https://…`; `ws://user@host`; not a URL |
| `private-relay` (403) | EN11 | a relay whose host the fake DNS resolves to 10.0.0.5, for the owner too |
| `too-many-relays` (400) | EN12 | eleven relays |
| `bad-cursor` (400) | EN13 | an `after` this operation didn't give |
| `no-assistant-key` (409) | EN14 | the child given no assistant keys |

## Edge cases

- **A node's letter isn't in the instance's relay** (its `id` set, strfry without it): `changed`, and a new letter signed (ES6's variant).
- **A tag past its fourth element.** An own letter today's routes signed has `["e", id, relay, marker, pubkey]`. When the letter changes for another reason, the new one keeps that tag whole (EL10).
- **White space and key order in a `json` tag** aren't a change (EL11).
- **A scope naming the same node twice,** through a graph and the graph it imports, sends it once (ES2).
- **A graph that lists an address no node holds** reports `not-found` (EK6).
- **Empty scope:** a graph with no nodes but itself answers its one letter. `everything` on a graph with no own nodes answers none, with no entry.

**Not pinned on purpose:**
- **How the record's write is batched,** and the `raced` case. Racing two exports needs a hook in the graph fake's transaction that nothing else needs. The Reviewer reads it in the code, and the live check fires two exports together. *(Round 1: the `raced` case is now pinned, ES18 and ES19, through the graph fake's `meanwhile`; the lock is not, next.)*
- **(Round 1) The record's write lock** (Amendment 2 item 1: each node's lock taken before its `id` is read). The graph fake runs one transaction at a time, so no two records interleave stack-free. ES18 and ES19 race a record against another that committed first, just before its first write to the node; the live check's LV5 fires two exports together, and the Reviewer reads the lock.
- **(Round 1) The record's tie rule, and whose letter the node held.** ES18 and ES19 race letters a minute apart, each the other export's, recorded in its entry. Two letters of one second (the lower id kept), and a record that finds a letter no export sent, aren't raced.
- **(Round 1) That the real `strfryImport` kills its child** when the call's time runs out. The suites replace the seam, and ES17's fake never resolves, whatever it is given, so the bound must hold where the call waits for the import. A stub executable that hangs would outlive a run whose code doesn't kill it. The Reviewer reads the kill.
- **The exact cap values** (2,000, 500, 40 s, 30 s, 5 s, 8 in flight). Suites shrink them through the seams, and the live check measures the real ones.
- **The words of each refusal and report,** beyond naming the input or node. A rewrite of the wording breaks no test.
- **Which micromark events the helper walks.** ML1–ML9 pin what it finds and how it rewrites.

## Test infrastructure

- **Runner:** each suite exports `run()`, and `test/operations.test.js` discovers them.
- **Seams the code must keep,** each read at each call, so a suite can set them before the catalog loads:
  - `src/operations/catalog/export/nostr.js`'s declaration carries `BUDGET_MS`, `SEND_CUTOFF_MS`, `MAX_SCOPE` and `MAX_SEND`;
  - `src/operations/catalog/export/_send.js` exports an object whose `strfryImport(lines)` it calls through that object. It resolves once `strfry import` ran, and rejects when it couldn't. The same object carries `OK_MS`, `IN_FLIGHT` and `now()`, the Unix time in seconds that `created_at` starts from;
  - `src/operations/catalog/import/_relay.js`'s `open()` answers `relay` beside `request` and `close`. Its `connect` stays the one seam for every connection, read and send;
  - the assistant's keys come from `src/utils/assistantKeys.js`'s `getOwnerAssistantKeys()`, and the publish policy from `src/api/publish-policy/index.js`'s `isPublishLocalOnly()`, which reads the environment at each call.
- **The harness hooks** (additive):
  - `operationsHarness.js` takes `assistantKeys: { privkey }` (null: none). Before the catalog loads, it gives `getOwnerAssistantKeys` that key's `{ privkey, pubkey, npub, nsec }`.
  - It takes `strfry: { file }`, which assigns `_send.js`'s `strfryImport` to a fake. The fake writes the letters into the fake relay `ws://127.0.0.1:7777`, or fails as the fixture says.
  - `externalCliServer.js` takes the same.
  - A missing `_send.js`, or one with no `strfryImport`, stops the run with that reason, so a suite fails for the right one.
- **`relayFake.js`, additively:**
  - Each relay takes `publish`: `accept` (the default, which stores the event), `refuse` with a reason, `duplicate`, `timeout` or `drop`.
  - `ids` limits each mode to some events.
  - Published and imported events are kept in `<file>.store.json`, so a later request, a read-back or a later call, sees them, newest first.
  - The fake relay object has `connected`.
  - The log gains `{ at: 'publish', url, id, outcome }` and `{ at: 'strfry-import', ids }`.
  - The `strfry` fixture takes `mode`: `ok`, `fail` (it can't run), or `drop`, which stores all but some ids.
- **Fixtures** (`test/helpers/exportFixtures.js`, new):
  - a concept made by the real graph operations, run through the harness: `graph create-concept`, `create-set`, `create-element`, `link-set` and `unlink-set`, `update-node`, `enumerate` and `add-relationship`, on the Cypher engine. Where the engine can't run a statement, the same nodes come from `_eventless.js`'s `makeNode` and the graph operations' own builders, never from hand-written tags;
  - the assistant's concept as today's routes leave it (`importFixtures.js`'s `ownConcept`), with its letters in the fake relay `ws://127.0.0.1:7777`, a letter with a five-element tag among them;
  - other authors' nodes, an owner-signed node, a kind 1 node, and a node with no address;
  - `exp(rid, caller, body)` and `runExport(…)`, as `imp` and `runImport` are;
  - readers: the letters a relay holds, `sentTo`, the entries, and `decodeNaddr`.
- **Keys.** The letters export signs are checked with nostr-tools' `verifyEvent`. The child's assistant is `importFixtures.js`'s `KEYS.ta`, whose secret is given through `assistantKeys`. Other authors and the owner signer are the same file's.
- **What the Implementer also meets:**
  - `tapestry-key-paths.test.js` scans every `CREATE` and `MERGE` of a node in `src/`;
  - the spy records every `finalizeEvent` and every strfry child process, and the suites read it to say what was signed;
  - `relationship-type-allowed.test.js` and the openapi coverage suite read the new declaration.
- **Firmware state:** none live. The allowed relationship types are firmware's files, read from disk.

### As built at Test Design

- **The hooks.** `assistantKeys` is the spec's, not a scenario's, since it must be in before anything loads: `test/helpers/assistantKeysFake.js` (new) sets `getOwnerAssistantKeys` on the module's exports through a `Module._load` interception, so a destructured import gets it too, and the spy records each call. `strfry: { file }` names the relay fixture, so the fake strfry import and the fake relays share one store. The seams are set from the relay fixture's `exportTiming`: `BUDGET_MS`, `SEND_CUTOFF_MS`, `MAX_SCOPE` and `MAX_SEND` on the declaration; `OK_MS`, `IN_FLIGHT` and `NOW` (which `now()` then answers) on `_send.js`. `externalCliServer.js` takes `assistantKeys` and `strfry` the same way.
- **`relayFake.js`, beyond the plan's list:** `addresses` beside `ids` (a letter's id isn't known before it is signed, its address is); `publishDelayMs`; `silentAfterImport`, the read-back that never ends (ES13); the store keeps the newest version at an address, as strfry does, and keeps out an older one; `writeFixture(file, cfg, { keep: true })`, so a later run sees what an earlier one sent; and a live relay answers each EVENT with OK, or drops the connection at the n-th (`dropOnEvent`, ES16).
- **Today's importers, stack-free** (EW2–EW5): `test/helpers/todaysImportersChild.js` (new) runs each handler's real code in a child. Stub executables first on its `PATH` (`test/helpers/todaysImportersStubs.js`, new): `strfry scan` answers from a fixture, `strfry import` keeps what it is given, and `cypher-shell` runs every statement on the Cypher engine. `src/lib/neo4j-driver.js`'s `runCypher` and `writeCypher`, and the graph seam, run on the same graph. Every statement is logged, so "no import statement ran" is read from the log, and each case is paired with a newer letter that is imported.
- **The world** (`exportFixtures.js`'s `world()`, built once a process in about 3 s): every graph operation the plan names ran through the harness on the Cypher engine, and the engine needed no extension. The firmware they need (fourteen concepts, five schemas, CITES) is today's letters, imported by today's builder, as an install leaves them. Nodes no operation makes (an author-less node, a node with no address) come from `_eventless.js`'s `makeNode`, or one `CREATE`. The file's header lists every node and what it is for.
- **What the suites read from an answer.** The ADR names the outcomes, classes and report codes, not every field. The accessors in `exportFixtures.js` say what is read: a letter's node is `node` (or `tapestryKey`); a relay's answer is `{ relay, status, reason }` in `relays`, the instance's own named `own` or by its URL; a report's code is `report` (or `code`, `kind`, `type`), and a report is found by the keys, addresses and words it mentions; counts by outcome; `added` and `removed` on a dry run's changed letter; `reports` before `letters` in the answer.
- **The markdown helper's API, as pinned:** `await findLinks(text)` gives `[{ form, destination, start, end }]`, the offsets the destination's own (a reference's, the reference itself); `await rewriteLinks(text, decide)` gives `{ text, links: [{ form, destination, action, to }] }`, and `decide(destination, link)` answers `{ to }`, `{ drop: true, name }` or `null`. Only `tapestry:` destinations reach it.

## How to run

Each suite alone, with every endpoint dead, `TAPESTRY_CONTAINER_PORT` unset, and stub `curl` (exit 7) and `docker` (exit 1) first on `PATH`, as story 32's were:

```
BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9 \
NEO4J_URI=bolt://127.0.0.1:9 REDIS_HOST=127.0.0.1 REDIS_PORT=9 TAPESTRY_CONTAINER=no-such-container \
node -e "require('./test/operations/export/nostr.test.js').run().then(r => console.log(JSON.stringify({pass:r.pass,fail:r.fail,skipped:r.skipped})))"
```

The same goes for `nostr-letters`, `nostr-links`, `markdown-links`, `nostr-send`, `nostr-own`, `nostr-agent-through-cli` and `nostr-live` (which skips), and for `test/publish-export-a-concept.test.js`.
- Never run `test/operations.test.js` beside the suites it runs.
- Never run the full `npm test` on the Mac Studio, whose stack is the agent-memory instance.
- The pull request's CI runs the full gate.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

First the uniqueness rules and `lifecycle migrate --migration tapestry-keys`, as story 32's check needed (`tmp/live-check-32/setup.sh`).

Automated in `nostr-live.test.js`, from a node process inside the container:
- **LV1** a concept made with the graph operations, exported into the stack's own strfry through the real `strfry import`, each letter read back over `ws://127.0.0.1:7777`.
- **LV2** the same call again: `unchanged`, nothing signed.
- **LV3** an `update-node`, then a dry run and an export: only that letter `changed`, the relay keeping the newer version.
- **LV4** import nostr of those letters: `own`, the graph unchanged.
- **LV5** two exports of one concept fired together: every node ends with one letter, and the next export answers `unchanged` or `changed`, never a failure.
- **LV6** 500 letters in one call, its seconds printed for the record against nginx's 60 s. The call goes straight to the control panel: through nginx it needs a signed-in session, which the suite doesn't hold, so the through-nginx run is part of LH1.

By hand, in the story's record:
- **LH1** EA1's sequence through the external CLI, by an admin agent with its own key, with no change to the CLI, sending to the outside relay the owner chooses. Its export calls go through nginx, so they also time a signed-in call there (LV6 times the direct one).
- **LH2** event-update on an exported node, through the control panel: `unchanged`.

## Raised at Test Design, and how each was settled

Each is settled by ADR 0034's Amendment 1, approved by the owner with this plan (2026-11-20):
- points 1 to 4 by its items 1 to 4: every relationship type but the `nostr` category's is reported; `relays` is zero to ten, with `too-many-relays` checked in `run`; a key no node has is `unknown-ref`; one class, in a set order;
- point 5 by item 5, which names the answer's fields. The accessors stay tolerant;
- point 6 by item 6: an entry only when some relay accepted a letter, a re-send included, and the cutoff bounds the outside relays only.

The points as raised:

1. **Which uncarried relationships are reported.** Decision 9 limits `uncarried-relationship` to "a type `structureTypes` allows". Yet the same decision lists "add-relationship's links" among those reported, and AC2 reports any relationship among the nodes sent that no letter can carry. add-relationship only adds declared, non-firmware types such as `CITES`, and `structureTypes` never allows those. So by the decision's own rule they are never reported. EL7 follows AC2 and the plan, and pins `CITES` reported. One of the two needs to change.
2. **`relays`: "1 to 10", "zero or more", or left out.** Decision 1 says 1 to 10 strings. AC1 says zero or more, and ADR 0043's signing step names no relays. A schema `maxItems: 10` would answer eleven relays with the built-in `invalid-input`, never `too-many-relays`; a `minItems: 1` would refuse `relays: []`. EN12 pins `too-many-relays` for eleven. No test sends `relays: []`.
3. **A key no node has.** `resolveOne` passes a tapestryKey through unread, so export's own check answers it. EN7 pins `unknown-ref` (404), AC7's "a ref that names no node", not the graph writes' `unknown-node`.
4. **A node that fits two classes.** Decision 3 doesn't say which comes first for another author's node of another kind. Its list order suggests `not-own`. EL8 uses an own kind 1 node, so it pins no order. Nor does it class a node with no author whose address carries another key; no test has one.
5. **Answer field names** the ADR leaves open (above, "What the suites read from an answer"). The accessors take a few spellings. If the Architect names the fields, the accessors can narrow to them.
6. **Not pinned, beyond the plan's list:** whether a re-send of unchanged letters (ES7), or a call in which nothing was accepted (ES13, ES14), writes a change entry; whether the own relay's strfry import counts as a send under `SEND_CUTOFF_MS` (ES10 times an outside relay); and the counts of relay classes (only outcomes are counted).

## Review round 1 (2026-11-21)

The review (`engineering-team/reviews/graph-operations-first-slice/34-export-nostr.md`) found two blocking and eleven non-blocking findings. The owner answered "Yes, as recommended", which became ADR 0034's Amendment 2 and the story's "Changed at Review" list. Tests come first, before the fixes. Each new or changed test below fails on the code at `0c1f2c4f` for the reason named, or is a pin that passes now and is labelled so. Blocking finding 2 (AC7's live run) is the owner's amendment, item 7, and takes no stack-free test. Findings 8, 10, 11 and 12 are the docs' and the story's Evidence, the Implementer's, and no test reads them.

| Finding (Amendment 2 item) | Test | What it does | Fails now because |
|---|---|---|---|
| 1, blocking (item 6): RE1 misses a publisher built export's way | **RE1** (changed; `publish-export-a-concept.test.js`) | `relayPublisher(text)`, a function in the file, flags a file that calls `.publish(` and either names `SimplePool`, `AbstractRelay` or `Relay`, or requires a module named `_relay`, as export's `_send.js` gets its relay from import's `_relay.js`. RE1 first checks that this flags `_send.js`'s own text, and a `SimplePool` publisher, and then that no file outside the two excluded folders is flagged. Its comment now says "another server-side publisher" (finding 9) | a pin: it passes now, as RE1 must. Its bite was checked in throwaway copies of the tree (below) |
| 3 (item 1): an `unread` letter is recorded nowhere | **ES13** (changed; `nostr-send.test.js`) | Its title and its node check said "not recorded", though they read only the node. The node check stays, reworded. It now also asserts one `export nostr` entry, answered as the call's `change`, with a change for each of the three letters: its node, address, the letter's id as `now`, and each relay's answer (`own` `unread`, the outside relay `not-sent`) | no entry: `change` is null |
| 3 (item 1): the call writes no entry when nothing reached anywhere | **ES14** (a pin added) | `change` is null and the graph holds no `export nostr` entry when every letter is `unreachable` | a pin: passes now |
| 3 (item 1): a record keeps the newest letter export sent | **ES18** (a pin), **ES19** (`nostr-send.test.js`) | Two exports through the operation, of pet's Rex and Tom, `now()` at 1,900,000,000. Just before each call's first write to its node, the graph fake's `meanwhile` commits another export's record: the node's `id`, `created_at` and `sentTo` set to that export's letter, and that export's entry, written by `changes.js`'s own `recordChange`. For Rex the other letter is a minute newer: the node keeps it, and the call's change says `raced`. For Tom it is a minute older: the node keeps the newest, the call's own letter, and its change isn't `raced`. Each asserts that `meanwhile` fired | ES18: a pin, passing now. ES19: today's record sets a node only while its `id` is the one the call read, so Tom keeps the older letter, `raced` |
| 3 (item 1): the guard reads the export entries | **EW2**, **EW5** (changed; `nostr-own.test.js`) | The graph gains an `export nostr` entry (`recordChange`'s own) recording a letter 50 s newer than the node's, its own relay `unread`, as an unread letter is recorded. EW2: event-update turns it away, unchanged, writing nothing over the node; on the same graph a letter 60 s newer that no entry records is imported, `updated`. EW5: `holdsLetterOrNewer` answers yes for it, and still no for a newer one no entry records. Its other cases now run on the graph with the entry | event-update imports the recorded letter (`action: updated`); `holdsLetterOrNewer` answers no |
| 4 (item 2): the header goes out 13th | **ES8** (changed; `nostr-send.test.js`) | Reads the order letters went into the instance's own relay. It asserts four things. The kinds never go back: headers, then supersets, then sets, then the rest, by the node's labels as Decision 2 ranks them. Within a kind, each letter goes after the letters of that kind it names, through the same tags and lists as before, and letters of one kind that name each other go by tapestryKey (the concept graph and the core nodes graph do). Pet's header goes before all twelve of its core nodes and elements. Each graph goes after the nodes its `graph.nodes` lists, unless a node of its own kind names it back. Today's check, each after the letters it names whatever their kind, is replaced, since a header now goes before the concept graph its `concept-graph` tag names | the header goes out after the property tree graph, with the superset and the three sets before it |
| 5: a leading byte-order mark | **ML10** (`markdown-links.test.js`), **EK8** (`nostr-links.test.js`) | ML10: a text that starts with U+FEFF holds an inline link, an autolink, and a definition with its reference. Each is found with its destination as written at its offsets, and rewritten, every other character kept, the mark first. A dropped link there keeps its text. EK8: graph update-node gives Fido a description that starts with the mark and links to dog's header. The setup checks the node keeps it. The letter carries the header's `naddr`, every other character kept, and no `tapestry:`. The mark is made with `String.fromCharCode(0xfeff)`, so no escape or raw mark sits in a file | every offset is one short: destinations `(tapestry:…`, `<tapestry:…`, ` tapestry:…`, none rewritten, so the letter keeps `tapestry:` |
| 6 (item 3): graphs not followed go unreported | **EK7** (`nostr-links.test.js`) | `_scope.js` holds the caps in module constants no suite can reach, so the graphs are built to size, each with makeNode (`exportFixtures.js`'s `graphNode`). Deep: g0 imports g1, and so on to g5; g4 lists Fido, g5 lists Spot and imports g6. Asserts g0 to g5 and Fido sent, Spot and g6 not, and one `graph-not-followed` report, naming g5. Wide: w0 imports w1 to w50, each listing an address no node holds. Asserts all 51 sent, one report naming one of the 50, no `not-found` for what that one lists, and a `not-found` for what each other one lists, so the other 49 were followed. The follow order isn't pinned | no report: `[]` |
| 7 (item 5): a hung `strfry import` holds the call 60 s | **ES17** (`nostr-send.test.js`) | `relayFake.js`'s strfry fake gains `hang`: it logs the import, stores nothing, and never resolves. `BUDGET_MS` is 3 s, and the harness stops itself at 15 s. Asserts the call answers within 3 s and a 5 s margin. Each letter's own answer is `unread`, `refused` or `unreachable`, as the read-back decides: the import kept nothing, so never `accepted`. `refused` is allowed because a read-back that runs after the import is stopped answers without them. The outside relay is `not-sent`, no node holds a letter, and nothing is published | the call never answers: the harness stops at its 15 s |
| 13 (item 4): `b` carries `INHERITS_FROM` | **EL12** (a pin; `nostr-letters.test.js`) | A child whose `b` tag inherits from a parent, both made with makeNode, an `INHERITS_FROM` each way, both sent through a graph listing them, dry run. Asserts the parent-to-child link, which no tag carries, is reported, so the report ran, and the child's, which its `b` tag carries, isn't | a pin: passes now |

**Helpers, additively.**
- `relayFake.js`: the strfry fixture's `mode: 'hang'`.
- `cypherGraphFake.js`: a `meanwhile` entry's `set: [{ key, props }]`, given to that node in the saved graph and in the transaction's copy alike, just before the statement.
- `exportFixtures.js`: `runExport`'s `timeoutMs`, the harness's own timeout. `exportEntry({ letters }, state?)`, an `export nostr` entry written by `src/operations/changes.js`'s own `recordChange` on the Cypher engine. `graphNode(state, { slug, nodes, imports })`, a graph element made with makeNode.

None changes an existing path. Each suite that uses them was run again alone: import nostr-own 7/0, nostr-relay 9/0, cypher-engine 12/0 and nostr-order 11/0, which use the Cypher fake's `meanwhile`; export nostr 15/0, nostr-agent-through-cli 1/0, and nostr-live 6 skipped. The graph and lifecycle suites with a `meanwhile` use `graphFake.js`'s, which is unchanged.

**The tests fail only for the missing behaviour.** A throwaway copy of the tree in the session's scratchpad, its `node_modules` linked, got a minimal stand-in for each item. The stand-ins:
- the helper's offsets one on after a leading mark;
- `sendOrder` run per kind, in kind order;
- graphs left by the depth cap or the 50th reported;
- `unread` letters put in the entry and not on their nodes;
- the record setting a node whose letter is older;
- the guard reading `export nostr` entries;
- the `strfry import` raced against the call's remaining time.

Every changed suite then passed: RE1's 3/0, markdown-links 10/0, nostr-letters 12/0, nostr-links 8/0, nostr-own 5/0, nostr-send 19/0. Then each pinned behaviour was broken in turn, and its pin failed. With the `b` carry taken out, EL12 failed: the child's link was reported. With the record's `WHERE` dropped, ES18 failed: the node took the older letter. With unreachable letters put in the entry, ES14 failed: an entry was written.

**RE1's red check.** Two throwaway copies of `src/api`, `src/operations` and `ui/src`, each with a copy of `_send.js` outside the excluded folders, as the review's probe did. One copy is at `src/operations/catalog/graph/_third-publisher.js`. The other is at `src/api/third/sender.js`, its requires re-pointed. The RE1 at `0c1f2c4f` passes both, which is blocking finding 1 reproduced. The RE1 now fails both, naming the copy:

```
  ✗ RE1: … A server-side external-relay publisher (.publish() on a relay made with SimplePool, AbstractRelay or Relay, or got from import's _relay.js) was introduced in src/operations/catalog/graph/_third-publisher.js — …
  ✗ RE1: … was introduced in src/api/third/sender.js — …
```

The tree as it is passes the new RE1.

**Counts now,** each changed suite alone, every endpoint dead, the stubs first on `PATH`, at `0c1f2c4f` with these files uncommitted:

| Suite | Before round 1 | Now | Failing now | Time now / expected once fixed |
|---|---|---|---|---|
| `publish-export-a-concept` | 3 / 0 | 3 / 0 | none (RE1 a pin) | 0 s / 0 s |
| `markdown-links` | 9 / 0 | 9 / 1 | ML10 | under 1 s / under 1 s |
| `nostr-letters` | 11 / 0 | 12 / 0 | none (EL12 a pin) | 9 s / about 8 s |
| `nostr-links` | 6 / 0 | 6 / 2 | EK7, EK8 | 7 s / about 6 s |
| `nostr-own` | 5 / 0 | 3 / 2 | EW2, EW5 | 7 s / about 7 s |
| `nostr-send` | 16 / 0 | 15 / 4 | ES8, ES13, ES17, ES19 | 34 s, ES17 waiting out the harness's 15 s / about 22 s |

Seven tests are new: ML10, EK7, EK8, EL12, ES17, ES18 and ES19. Six are changed: RE1, ES8, ES13, ES14, EW2 and EW5. Nine fail; every other test passes as before. The mark in EK8's message printed raw, and is shown here as `<U+FEFF>`:

```
  FAIL  ML10 … a text that starts with a byte-order mark has its links found at their offsets and rewritten, every other character as it was
        after the mark, each link is found with its destination as written; got [{"form":"inline","destination":"(tapestry:00000001-aaaa-4bbb-8ccc-ddddddddddd","start":10,"end":55},{"form":"autolink","destination":"<tapestry:00000003-aaaa-4bbb-8ccc-ddddddddddd",…},{"form":"reference","destination":" tapestry:00000002-…",…},{"form":"definition","destination":" tapestry:00000002-…",…}]
  FAIL  ES8 … letters go out by kind first, headers, supersets, sets, the rest; …
        letters go out by kind of node first: concept headers, then supersets, then sets, then the rest; got ["pet (header) went out after pet-property-tree-graph (rest)"] in the order ["pet-superset (superset)","lap-pets-a3381a64 (set)","strays-a3381a64 (set)","walkers-a3381a64 (set)",…,"pet-property-tree-graph (rest)","pet (header)","pet-core-nodes-graph (rest)",…]
  FAIL  ES13 … the read-back doesn't answer: each letter unread, not-sent out, recorded in the call's change entry with each relay's answer, and not on its node
        the call writes one change entry, export nostr, and answers it; got 0 entries and change null
  FAIL  ES17 … a strfry import that never ends doesn't hold the call: …
        the call answers while its strfry import never ends; it hadn't answered when the harness stopped at its own 15000 ms: the harness timed out after 15000 ms
  FAIL  ES19 … of the letters export sent for a node, the node keeps the newest: …
        the node holds this call's letter, 9df48aeb… at 1900000000, the newer of the two, not the other export's, 9419374e… at 1899999940; got {"id":"9419374e…","created_at":1899999940,"sentTo":["own"]}
  FAIL  EW2 … event-update at an exported node answers unchanged for its letter, an older one, and a newer one an export nostr entry records for it, writing nothing; …
        a newer letter an export nostr entry records for the node: event-update answers success and unchanged; got {"status":200,"body":{"success":true,"action":"updated",…}}
  FAIL  EW5 … holdsLetterOrNewer answers yes for … a newer one an export nostr entry records for the node; …
        (round 1) a newer version an export nostr entry records for the node: yes; got false
  FAIL  EK7 … a graph past the fourth level of imports, and the 51st graph, are each sent with their lists unfollowed and reported graph-not-followed, naming it
        one graph-not-followed report, naming g5, five levels below; got []
  FAIL  EK8 … an element field whose markdown starts with a byte-order mark has its tapestry: link rewritten in the letter, the mark kept
        no tapestry: is left in the letter; got "<U+FEFF>see [the dog concept](tapestry:cbf1abed-8ffb-4368-970b-1004a1b10c00) here"
```

## Verification

The new tests fail with the current code, each for the right reason. Confirmed on 2026-11-20 on `A10.34-export-nostr` at `238d8cff` (staging `79c8a098` with the story and ADR 0034), this phase's files uncommitted beside it. Each suite ran alone, every endpoint dead, the stubs first on `PATH`:

```
nostr.test.js                     {"pass":0,"fail":15,"skipped":0}
markdown-links.test.js            {"pass":0,"fail":9,"skipped":0}
nostr-letters.test.js             {"pass":0,"fail":11,"skipped":0}
nostr-links.test.js               {"pass":0,"fail":6,"skipped":0}
nostr-send.test.js                {"pass":0,"fail":16,"skipped":0}
nostr-own.test.js                 {"pass":0,"fail":5,"skipped":0}
nostr-agent-through-cli.test.js   {"pass":0,"fail":1,"skipped":0}
nostr-live.test.js                {"pass":0,"fail":0,"skipped":6}
publish-export-a-concept.test.js  {"pass":3,"fail":0}             RE1 widened, passing as before
```

63 tests fail, for three reasons:

```
  EN1–EN15, EL1–EL11, EK1–EK6, ES1–ES16, EW1–EW4, EA1:
        src/operations/catalog/export/nostr.js does not exist yet (ADR graph-operations-first-slice/0034 Decision 1)
  ML1–ML9:
        src/lib/markdownLinks.js does not exist yet (ADR graph-operations-first-slice/0034 Decision 7: findLinks(text) and rewriteLinks(text, decide), with micromark 4)
  EW5:  holdsLetterOrNewer answered; got src/operations/catalog/export/_own.js does not exist yet (ADR graph-operations-first-slice/0034 Decision 10)
  (export nostr's live checks skip: TAPESTRY_CONTAINER is 'no-such-container', not a scratch container (its name must start with tapestry-scratch). …)
```

**Each test gets past its declaration check.** A copy of the tree in the session's scratchpad ran the suites against a throwaway stub of the operation. The stub had the declaration, the three scopes, the letter builder, the compare, the sender, the record and the reports, plus the three importers' guards and a hand-rolled link scanner standing in for micromark. 62 of the 63 passed. EN15 failed, since the stub wrote no docs. None crashed.

That run found faults in the tests, since fixed. The send chain read `a1.store()` and the log after later runs had replaced versions in the store and added to the log. Its later runs rewrote the relay fixture without the outside relay. A failure message called `.slice` on `undefined`. EL8's node of another kind was another author's, so `not-own` was just as right.

**The tests bite.** Each of four faults put into the stub failed the tests it should:
- no guard in event-update: EW2;
- `s` taken from the would-be tags: EL2, and EL6's round trip, which found the stale parent;
- `json` compared as text: EL11;
- a dry run taking the signing path: ES2, ES4 and ES6.

A third publisher, built the export's way under `src/operations/catalog/graph/`, failed RE1, and passed it once moved under `src/operations/catalog/export/`.

**The helpers' changes are additive.** Each existing suite that uses them was run again alone, and all pass:

| Suite | Pass | Fail | Skipped |
|---|---|---|---|
| import/nostr-own | 7 | 0 | 0 |
| import/nostr-relay | 9 | 0 | 0 |
| import/nostr-graph | 12 | 0 | 0 |
| import/nostr-agent-through-cli | 1 | 0 | 0 |
| import/cypher-engine | 12 | 0 | 0 |
| import/nostr | 15 | 0 | 0 |
| import/nostr-record | 15 | 0 | 0 |
| import/nostr-order | 11 | 0 | 0 |
| import/nostr-filter | 10 | 0 | 0 |
| import/nostr-live | 0 | 0 | 6 |
| graph/create-concept | 23 | 0 | 0 |
| graph/agent-through-cli | 1 | 0 | 0 |
| lifecycle/status | 9 | 0 | 0 |

**Suite times** against the stub, each alone: nostr 5 s, markdown-links under 1 s, nostr-letters 7 s, nostr-links 4 s, nostr-send 25 s, nostr-own 6 s, nostr-agent-through-cli 3 s. Each export suite but markdown-links includes the world's 3 s build.
