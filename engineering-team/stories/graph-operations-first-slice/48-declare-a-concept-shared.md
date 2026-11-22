# Story 48: Declare one of the instance's own concepts a shared concept, affiliate it, or mark it deliberately unaffiliated, through the graph operations, so export nostr sends it as one

**Status:** Done
**Created:** 2026-11-21
**Type:** Feature
**Loom:** A10.44 — https://loom.brainstorm.world/t/A10.44

## Background

Loom's A10.44 was drafted from P-162, which the owner accepted on 2026-11-21 with himself as builder. It asks to place three of today's routes among the operations, "which the catalog's §9 lists as still to place, so a header's community references are written in the graph, with a change entry, the rules checked and no event signed first, and export nostr sends them with the header." Done, for Loom, is when "each is declared once; answers at `/api/tapestry/<group>/<operation>` for whoever its ADR names; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used them through the external CLI, so that export nostr sends a concept the agent declared shared, its self-pointing `b` included."

**Why now.** The owner, on P-162: "The main reason I want to do this is to explore the protocol for community curation of a DList. So for the next step, I would like to publish this concept to nostr as a shared concept. Do we have the tooling in place yet to do that?"
- **The concept** is vulnerability on david.tapestry.ninja (`39998:<TA>:vulnerability`). It lists published vulnerabilities that anyone running a Brainstorm or Tapestry deployment should check for, three NGINX CVEs so far, and was built with the graph operations on 2026-11-20 and 21.
- **What's missing.** Export nostr (story 34) can publish it now, signed by the instance's assistant, but only as a list of the instance's own. Nothing lets the instance offer it as a shared concept, one that other authors may affiliate with.
- **Another use.** P-149's story 4, in which each hosted Tapestry shares one concept, would use the same tooling.

**What makes a concept shared.** The wire form is protocols/drafts/inherit-from.md § "The `b` tag", and the policy is protocols/drafts/shared-concepts.md. A header's `b` tags give it one of three dispositions:
- **Self-declared.** A pointer `b` that names the header's own address: `["b", "39998:<TA>:<d-tag>", "pointer"]`. "Its author offers it as a shared concept, one that other authors may affiliate with."
  - It is "a claim, not an outcome": whether other authors converge on the header is resolved per point of view. It carries no weight in any aggregate.
  - "Derived as a pointer, it yields a self-loop, `(header)-[REFERENCES {source:'b-tag'}]->(header)`."
- **Wired (affiliated).** A pointer `b` that names another author's shared concept by its address.
- **Deliberately unaffiliated.** The reserved marker `["b", "b-tag-deferred"]`, "a disposition marker, not a correspondence claim".
  - "A real affiliation supersedes it": declaring or wiring the header replaces the marker.
  - "Like any tag it travels with its header if the header is published; a header that never leaves its author's local relay keeps its deferral private by construction." ADR shared-concepts-adoption/0001 wrote that sentence.

The Shared with the community page lists every header on `wss://dcosl.brainstorm.world` whose `b` names its own address. That is the relay the concept page's buttons send to (`ui/src/utils/dispositionActions.js:8`, `ui/src/hooks/useCommunitySharedConcepts.js`).

Nine facts about today's code shape the story. They come from reading staging at `f2e149876` (2026-11-21). Nothing was run.

1. **Three owner-only routes write a header's dispositions.** They are `POST /api/concept/:handle/self-declare`, `b-append` and `b-defer` (`src/api/concept/selfDeclare.js`, `src/api/concept/bDisposition.js`), open to the owner and direct-local callers (`src/middleware/routeAccess.js:164-168`). Each:
   - takes only the instance's own headers ("never re-sign another author's event under our identity");
   - reads the header's newest letter from the instance's relay, and answers 404 when it has none;
   - signs a new letter as the assistant, with the `b` added, and puts it in the instance's relay;
   - writes that letter over the node with normalize's `importEventDirect`. That deletes the node's tag nodes and makes them again from the letter, in separate statements, and draws no relationship from a `b` (`src/api/normalize/helpers.js:64-120`). No change entry is written and no rule is checked.

   What each one does:
   - **self-declare** adds the self-pointing `b`, takes out a deferral marker and keeps every other tag. On a header that already has it, it answers `already-declared` and signs nothing.
   - **b-append `{target}`** adds `["b", target, "pointer"]`. It refuses a target that isn't `kind:pubkey:d-tag`, and the header's own address ("self-declare's lane"). It answers `already-wired` for a target the header already names, and takes out a deferral marker.
   - **b-defer** adds the marker. It refuses a header that has a real `b`, with HTTP 200 and `success: false`, and answers `already-deferred` for a header that has the marker.

   The concept page's buttons call them. The browser then sends self-declare's and b-append's letters to `wss://dcosl.brainstorm.world`, and never sends b-defer's: "deferral is a stance, not an announcement."
2. **A fourth route writes a `b`, and the catalog doesn't list it.** `POST /api/normalize/set-b-tag` sets, replaces or removes a pointer or inherit `b`, with an optional note, on any node with tags. It is owner-only, because "the event is signed with the TA key". It rebuilds the letter from the graph's tags, signs it, and imports it with `buildImportCypher`, which draws the `b`'s relationship (`src/api/normalize/index.js:4715-4806`). §9 has no row for it.
3. **No operation writes a `b` for the instance's own concepts.** create-concept gives a header no `b`, and seed-firmware writes only the `b` tags firmware gives its own concepts (`src/operations/catalog/lifecycle/_seed.js:593-610`). `graph add-relationship` refuses `REFERENCES` and `INHERITS_FROM`, the relationships a `b` draws, as reserved (rule 2, `relationship-type-allowed`).
4. **Export sends the `b` tags the header's node holds.** A letter carries every tag node but `s`, `d` and `json`, which export makes itself (`src/operations/catalog/export/_letters.js:143-150`). So a `b` tag node goes out as it stands, a deferral marker included. For each element whose concept header is the instance's own, export also adds a `z` for each pointer `b` that names another concept, up to five (`:201-225`; ADR shared-concepts-adoption/0004). That is how the elements of an affiliated concept come to be listed under the shared one.
5. **The button and a graph-made concept.** P-162 left open whether the button already does the job for an owner once export has sent the header.
   - **By the code:** after an export, self-declare would find export's letter, sign a new one with the `b` added, and write it over the node.
   - **What that does to the node:** the node's tags would become the letter's, and its JSON would become the one export built: the stored JSON, less graphContext, with its `tapestry:` links rewritten (story 34, fact 11).
   - **What else it leaves out:** there would be no change entry and no `b` relationship, and an admin's agent can't call it.

   So the button doesn't make the task smaller.
6. **Other writes keep a header's other tags.** `graph update-concept` edits the header's slug, description and json tags where they are. It removes a tag only when it clears the description (`src/operations/catalog/graph/update-concept.js:126-155`). A concept's address doesn't change with its slug, so a self-pointing `b` stays true after a rename.
7. **The self-loop that story 39 removed is a different case.** Community-reference ADR 0035 (story 39, on staging 2026-11-21) stopped firmware install from giving production's nostr-relay header a `b` naming itself, and the self-loop that came with it. That `b` came from firmware's community reference naming production's own header, not from a declaration. A self-declaration's self-loop is the one the spec describes (inherit-from.md § "The `b` tag").
8. **A firmware reinstall drops a `b` the owner wrote on a firmware header.** This bug is queued in `stories/_intake.md` (2026-11-21). So a declaration on one of firmware's own concepts wouldn't survive a reinstall today.
9. **Who may sign as the assistant.** Export nostr is open to the owner and admins, to any relay (catalog §10, question 2, answered at story 34's gate, 2026-11-20). ADR shared-concepts-adoption/0001 kept the three routes owner-only as routes that sign with the assistant's key, and set-b-tag is owner-only on the same ground.

**The design it follows** (docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md):
- **D1.** Writes never sign. Export is the publisher.
- **D2.** "The node first, the letter on purpose." A caller declares the concept shared, then exports it.
- **D4 and D8.** The owner's and admins' writes change the instance's own nodes. Another author's node is copied first, never re-signed.
- **D10.** Every fact in a node's JSON is also stored in the graph.
- **BIBLE §30.** A `b` written in the graph is the instance's own state, with no letter behind it until an export. No import, reinstall or rebuild may destroy it.

## User-facing description

As the owner, or an admin's agent, I want to declare one of my instance's own concepts a shared concept, wire it to another author's shared concept, or mark it deliberately unaffiliated, each with one call through the graph operations. Export nostr should then send the concept as I declared it, so that others can find it on the community relay and affiliate their own concepts with it.

As the same owner, I want each call written in my graph like any other graph write: a change entry naming who made it, the header's other tags and its JSON left as they are, and nothing signed or sent until I export. When a call doesn't make sense, I want it refused, with the reason.

## Acceptance criteria

- [ ] **AC1 — Declare a concept shared.** Given one of the instance's own concept headers, with a letter or with none, when the owner or an admin calls the declare operation on that concept:
  - the header's node holds the self-pointing pointer `b`, `["b", "39998:<TA>:<d-tag>", "pointer"]`, once;
  - a deferral marker it held is gone, and every other tag, and its JSON, are as they were;
  - one change entry records the call and who made it, and nothing is signed or sent;
  - the answer says whether the header's letter, if it has one, no longer matches it, as the other graph writes do.

  Called again, it answers `already-declared` and changes nothing.
- [ ] **AC2 — Wire it, or mark it deliberately unaffiliated.** Given the same header, when the owner or an admin calls:
  - **the wire operation** with a target address, a concept header's `39998:pubkey:d-tag` or an naddr of one *(amended at Architecture, ADR 0048 Decision 2: kind 39998 only)*, then the node holds `["b", <target>, "pointer"]` once, beside any `b` it already holds, and the rest is as in AC1. Called again with the same target, it answers `already-wired`. A target the graph doesn't hold is reported and still written, since anyone's concept may be a target.
  - **the defer operation** on a header with no `b` naming an address or an event id, then the node holds `["b", "b-tag-deferred"]` once, and the rest is as in AC1. Called again, it answers `already-deferred`.
- [ ] **AC3 — What they refuse.** Each refuses, changes nothing and names the reason, with a test for each refusal:
  - every call refuses a caller who isn't the owner or an admin (open question 1);
  - every call refuses a node that isn't a concept header, another author's concept header, and a header whose address carries the owner's key, which the assistant can't sign a new version of;
  - every call refuses one of firmware's own concepts, as `graph update-concept` does (fact 8);
  - the wire operation refuses a target that isn't a concept header's address *(amended at Architecture, ADR 0048 Decision 2)*, and the header's own address, which is the declare operation's job;
  - the defer operation refuses a header that has a real `b`: a declaration or a wiring beats a deferral.
- [ ] **AC4 — Export nostr sends them.** Given a header declared shared or wired through these operations, when export nostr runs with a scope that holds it:
  - the header's letter carries each `b` as the node holds it, the self-pointing `b` included;
  - a dry run first lists the header as new, or as changed if it was sent before;
  - each element's letter carries a `z` for each concept the header is wired to, up to export's cap of five (fact 4).

  A deferral marker travels with its header like any tag (shared-concepts.md). So it leaves the instance only in a letter export sends.
- [ ] **AC5 — Declared once, and used by an agent.**
  - Each is declared once, answers at `/api/tapestry/<group>/<operation>`, and has its internal CLI command and `/docs` entry made from the declaration.
  - Catalog §9's row for the three says where they now are, and set-b-tag gets a row of its own, still to place.
  - An agent, through the external CLI, declares a concept shared and exports it to a stack's own relay, and the letter read back from that relay carries the self-pointing `b`.

## Concepts touched

The assistant's pubkey differs on every instance, so `<TA>` stands for it. The Architect resolves handles at runtime and never writes a literal.

- `39998:<TA>:<d-tag>`: any of the instance's own concept headers. Its `b` tags are what the three write.
- `39998:<TA>:relationship-type`: the relationship type concept. Rule 2 reserves `REFERENCES` and `INHERITS_FROM`, the relationships a `b` draws (open question 3).
- `39998:<TA>:vulnerability` on david.tapestry.ninja: the first use, after this story ships.

## Out of scope

- **set-b-tag's other jobs:** taking a `b` out, an inherit-typed `b`, and a note. The three today's routes do none of them. set-b-tag gets a catalog row, still to place (AC5).
- **Today's routes and their buttons.**
  - Moving the concept page's three buttons and the disposition panel onto these operations.
  - What today's routes do to a graph-made concept (fact 5). That is ledger row `2026-11-20-todays-importers-keep-their-faults`.
  - The routes for a user's own headers (`/api/list-headers/me/…` and `/api/list-headers/my-assistant/…`), which sign in the browser or as that user's assistant.
- **A firmware reinstall that drops an owner's `b`.** That is the queued intake entry (fact 8).
- **Taking back a declaration that was sent:** export retract, A10.34's subtask.
- **The app layer:** the adoption queue and the shared-concept registry (catalog §9: "the app layer: shared concepts").
- **The first use on david.tapestry.ninja.** Zeus declares vulnerability shared and exports it to `wss://dcosl.brainstorm.world`, once the instance runs this code and on the owner's yes, since it writes to a public relay.

## Open questions

**For the owner:**
1. **Who may call them? Answered** (the owner, 2026-11-21: "Owner and admins"). The owner and admins may, as export nostr's callers are.
   - Export, which is what actually publishes, is already open to admins. An admin can already rename a concept and change its description with `graph update-concept`.
   - Each call's change entry names who made it.
   - Zeus, an admin, can make the first use.
   - This widens ADR shared-concepts-adoption/0001's owner-only rule for these operations only. Today's routes stay owner-only (Out of scope).

**For the Architect:**
2. **Names and group.** What the three are called and which group they sit in. They could also be one operation that takes a disposition. **Resolved** (ADR 0048 Decision 1): three writes in the `graph` group, `declare-shared`, `wire-to-shared` and `defer-sharing`.
3. **The relationship a `b` draws.** Whether the write draws `REFERENCES {source:'b-tag'}`, a self-loop for a declaration, as D10 and the spec suggest, or leaves that to an import of the letter. Rule 2 reserves the type, and story 39 removed a firmware self-loop (fact 7). **Resolved** (ADR 0048 Decision 6): the write draws it, as seed-firmware and the importers do, to a placeholder when the target isn't held, and as a self-loop for a declaration.
4. **What the wire operation accepts as a target.** Any address, as today's route does, or only a concept header's. **Resolved** (ADR 0048 Decision 2): a concept header's address, kind 39998, or an naddr of one, since export makes each wired `b` an element's `z` stamp, which must name a header.
5. **Where the new `b` goes among the header's tags.** Export keeps a letter's order, or puts `d` first, `json` last and the rest by type. **Resolved** (ADR 0048, fact 5): export decides. It keeps the order of the letter the node has, and adds the rest in its own order, since the graph's tag nodes hold no order.

## Deviations

Judgment calls made in Implementation (2026-11-21), each too small for an ADR amendment. None goes outside ADR 0048 or its Amendment 1.

- **The target is trimmed** before its form is checked, as today's `b-append` route and `resolve.js` trim theirs, so the `b` holds the trimmed address. Decision 2 doesn't say.
- **`disposition` is worked out, not read again.** It comes from the `b` values read after the locks, less the markers the call took out, plus the `b` it added. In one transaction under the locks, that is what a read after the call would give (Amendment 1, item 2).
- **`not-own-concept`'s two cases** are told apart with `reads.js`'s `ownKeys()`. An author that is one of the instance's own keys, but not its assistant's, is the owner's; any other is another author's. With no assistant key, every header is refused, as update-concept refuses it.
- **`affiliated` reads the header with `dispositionOf`**: it is refused when it is self-declared or wired. That is today's `b-defer` test, a value that is an `a-tag` or an `event-id`, through `bValueForms.js`.
- **More than one node at a target's address.** The uniqueness rules allow a `NostrEvent` and a node without that label at one uuid. `target.node` is then the one the graph holds (it has a `created_at`), else the lowest tapestryKey. The suites hold one node at each address.
- **A node with no tapestryKey** at a target's address, or a deferral marker with none, fails the call (500), naming `lifecycle migrate`, as update-concept fails for a tag with no key.
- **`relationship-added` comes from the statement's counters** (`relationshipsCreated`), as add-relationship reads them. The statement fails the call if either end went missing, so a `b` is never written without its relationship.
- **The helper's names.** `headerOf` answers `tags` and `values` beside the ADR's `{ facts, h, bTags }`. `addB` and `dropMarkers` take that answer rather than `h`, since the new tag's index is the header's tag count. Three small helpers are added beside the ADR's: `nodeAt` (the target's `held` and `node`, for a first call and a repeat alike), `link` (the `MERGE`) and `answerOf` (the answer's shared fields).
- **Where the docs sit.** The catalog lists the three after update-concept, in §2 and in "At a glance". set-b-tag's §9 row follows the row for today's three routes. BIBLE §25's bullet is the section's last, and its "Last updated" line is left as it is, as story 34 left it. The skill's sentence follows "No other operation signs a nostr event."

### Review round 1's findings (Amendment 2)

Judgment calls made at the second Implementation round (2026-11-21), each too small for another amendment. None goes outside Amendment 2.

- **`REFERENCES`' makers, in the rule's words:** "import nostr, and graph declare-shared and wire-to-shared from a b tag". So add-relationship's refusal reads "REFERENCES is reserved: it is made by import nostr, and graph declare-shared and wire-to-shared from a b tag, with the checks it needs." The rule suite's `REFERENCES: /import nostr/` still holds.
- **The adoption's answer isn't read.** Where `nodeAt` found no node, it changes nothing, and in the race it adopts the node that appeared. Either way the `MERGE`'s `RETURN` says which node the relationship runs to.
- **The docs' wording.** `inherit-from.md`'s sentence becomes two, the second saying which writes draw a relationship. BIBLE §25's bullet now says that, when the graph doesn't hold the target, the relationship runs to the placeholder at its address, or to one the write makes when no node is there. The catalog's wire-to-shared row already read true, so it is unchanged.

## Evidence

### The suites (Implementation, 2026-11-21, 22:13–22:44Z, on the tree uncommitted beside `092511d9c`, the tests' commit)

Every run went through the session's wrapper (`safe-run.sh`): stub `curl` and `docker` first on `PATH`, `BRAINSTORM_CONF_PATH` on a conf whose Neo4j is a closed port, every endpoint a dead port, and `TAPESTRY_CONTAINER` and `TAPESTRY_CONTAINER_PORT` unset. Nothing reached this Mac's agent-memory instance. The records are in `tmp/a10-44-impl/`.

- **Before the change,** `test/operations.test.js` alone: 1,502 passed, 52 failed, 20 skipped. The 52 were the 50 new tests, MF15 and EN29.
- **Each new suite alone,** as the code was written: declare-shared 14, wire-to-shared 18, defer-sharing 11, the export cases 6, and the agent through the external CLI 1, all passing.
- **After it,** `test/operations.test.js` alone: 1,552 passed, 2 failed, 20 skipped. The 50 new tests, MF15 and EN29 pass.
  - The two failures are `tapestry-key-paths.test.js` G11 and G18. They ask that every source line naming `:NostrEvent` alone be listed in `test/operations/lifecycle/nostr-event-lookups-kept.json`, with why. The placeholder's `CREATE (p:NostrEvent {uuid: $uuid})` in `_dispositions.js` isn't listed yet. It is import nostr's placeholder (Decision 6), whose own line is listed.
  - That file is under `test/`, which this phase left alone, so the entry waits (below).
- **With that one entry,** in a copy of the tree (HEAD, this phase's files and the entry, never the worktree): `tapestry-key-paths.test.js` alone gives 20 passed, 0 failed (18 and 2 without it), and `test/operations.test.js` alone gives 1,554 passed, 0 failed, 20 skipped.
- **The other suites,** each in its own process: the five the gate names beside `operations.test.js`, and every registry suite whose source names the catalog, BIBLE, `inherit-from.md`, a `SKILL.md` or `bValueForms.js`, `event-tagging-firmware-seed` left out. That is 48 suites: 1,582 passed, 10 failed, 82 skipped.
  - external-cli 53, openapi-coverage 13, admin-action-sweep 9, schema-save-finds-the-right-header 26 (2 skipped), gate-result-record 34, b-tag-primitive 16, b-coverage-audit-and-disposition 18, curated-dlist-update-pointer-switch 12 and harness-lint 85, all passing.
  - The 10 failures are this Mac's, and fail the same on the copy of HEAD: router-stream-limit-on-connect P1–P3 (BSD sed), and safe-to-merge-check B1–B3, B5, B6, B8 and B9 (timeouts behind the stub `curl`).

### The kept entry (the Tester's lane, 2026-11-21)

- **The entry G11 and G18 asked for** is added in a commit of its own, apart from the implementation's. It sits after import nostr's `CREATE (p:NostrEvent {uuid: a.uuid})` entry, which it mirrors (the test plan, § "Added at Implementation"). `tmp/a10-44-impl/kept-entry.js` wrote it:

  ```json
  {
    "file": "src/operations/catalog/graph/_dispositions.js",
    "text": "const PLACEHOLDER = `CREATE (p:NostrEvent {uuid: $uuid})",
    "reason": "A CREATE, which can't take a label disjunction: graph wire-to-shared's placeholder for a wired b's target at an address, import nostr's kind (ADR graph-operations-first-slice/0048 Decision 6), made only when the same transaction's lookup by NostrEvent|TapestryNode found no node there. It stands for an event, so it is a NostrEvent."
  }
  ```

### The scoped gate with the kept entry (2026-11-21, 22:48–22:59Z, on the tree uncommitted beside `092511d9c`)

Through the same wrapper, with nothing reaching its stubs:
- **`test/operations.test.js` alone:** 1,554 passed, 0 failed, 20 skipped.
- **The 48 suites above,** each in its own process: 1,582 passed and 10 failed. The 10 are this Mac's, the same as before: router-stream-limit-on-connect P1–P3, and safe-to-merge-check B1–B3, B5, B6, B8 and B9.

The full gate's verdict is the pull request's CI. On this Mac only a scoped gate runs, since the container named `tapestry` is the owner's agent-memory instance.

### The live check (AC5, 2026-11-21, 22:52–22:54Z, scratch stack `tapestry-scratch`)

The image is `tapestry-tapestry`, with this branch's `src/` mounted read-only. Nothing reached the agent-memory container, and no letter left the stack.

- **Setup.** Story 34's recipe, copied (`tmp/live-check-48/setup.sh`):
  - the branch's firmware, `bin/tapestry.js` and `clients/cli` copied in;
  - a throwaway owner, admin and stranger;
  - the uniqueness rules, then `lifecycle migrate --migration tapestry-keys`, then the branch's firmware installed;
  - strfry-router stopped, with `BRAINSTORM_PUBLISH_LOCAL_ONLY=true`.

  The four new files inside matched the worktree's by digest. The image predates `micromark`, so its packages were copied in (`micromark.sh`), and `import('micromark')` loads in the container.
- **LH1, by hand: 25 of 25 checks ok** (`tmp/live-check-48/lh1.js`, `by-hand.log`). The admin agent, with its own key, ran the unchanged external CLI inside the container, through its nginx:
  - It made three concepts, toy, game and kite, and an element of game.
  - **`graph declare-shared` on toy** answered `declared`. The disposition was self-declared, with `bValues` its own address, and `letterOutOfDate` false. The entry, the admin's, holds `tag-added` and `relationship-added`, and toy's header holds one self-loop `REFERENCES {source:'b-tag'}`. A repeat answered `already-declared`, change null.
  - **`graph wire-to-shared` game → toy** answered `wired`, with `target { address, held: true, node: toy's header }`. Game's header holds one `REFERENCES {source:'b-tag'}` to toy's. A kind-39999 target was refused `bad-target`.
  - **`graph defer-sharing` on kite** answered `deferred`. On the declared toy it was refused `affiliated`.
  - **`export nostr`, for each concept graph:** a dry run listed its header `new` and sent nothing. The export then sent 8, 9 and 8 letters to the stack's own relay only, each accepted.
  - **Read back from the stack's strfry by id:**
    - toy's header letter verifies, is the assistant's, and carries `["b", "39998:<TA>:toy-…", "pointer"]`;
    - game's header letter carries `["b", <toy's address>, "pointer"]`;
    - game's element carries the stamp, `["z", <toy's address>]`, beside its own `z`;
    - kite's header carries `["b", "b-tag-deferred"]`.
  - `graph history` of toy's header shows its one `graph declare-shared` entry, by the admin.

The records are in the worktree's `tmp/live-check-48/`, to be copied to the main checkout's `tmp/` before the worktree goes.

### Review round 1's findings (Amendment 2): the suites (2026-11-22, 01:11–01:24Z, on the tree uncommitted beside `e0830e8df`, the tests' commit)

Through the same wrapper, with nothing reaching its stubs. The records are in `tmp/a10-44-impl/r2/`.

- **Before the fix,** as the tests' commit records it: `test/operations.test.js` alone gave 1,552 passed, 4 failed, 20 skipped. The four were WS19, WS20, G11 and G18.
- **The suites the fix touches, each alone:** wire-to-shared 20 passed (WS19 and WS20 among them), `tapestry-key-paths` 20 passed (G9, G11 and G18 among them), and `relationship-type-allowed` 10 passed, none failing.
- **After it,** `test/operations.test.js` alone: 1,556 passed, 0 failed, 20 skipped.
- **The derived suites,** each in its own process: the Reviewer's 53 (`tmp/review-48/suites.txt`), the Reviewer's two scans of all of `src/` (config-parse-leak and assistant-taggings-publish), and the two registry suites that name the rule file (firmware-element-sync and graph-rules-builder). That is 57 suites: 1,732 passed, 10 failed, 88 skipped.
  - The 10 failures are this Mac's known ones: router-stream-limit-on-connect P1–P3, and safe-to-merge-check B1–B3, B5, B6, B8 and B9.
- **Not run here:** LH2, Amendment 2 item 4's live check, which the coordinating session runs on a scratch stack.

## Linked artifacts
- ADR: `engineering-team/decisions/graph-operations-first-slice/0048-declare-shared-wire-to-shared-defer-sharing.md`
- Test plan: `engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.test-plan.md`
- Review: `engineering-team/reviews/graph-operations-first-slice/48-declare-a-concept-shared.md`
