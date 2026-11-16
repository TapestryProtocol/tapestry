# Story 9: `graph resolve` — turn a name, slug or nostr address into tapestryKeys

**Status:** Approved
**Created:** 2026-11-16
**Type:** Feature
**Loom:** A10.9 — https://loom.brainstorm.world/t/A10.9

## Background

Loom's A10.9 asks for one graph read (catalog §1, Graph reads): **`graph resolve`**, which turns "a name, slug or nostr address into tapestryKeys", taking `ref` and answering "candidates, with any ambiguity reported". Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/resolve` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

Eight facts about today's instance shape the story:

- **The catalog's convention depends on it.** "Every input that names a node takes its `tapestryKey` (D6), or a name or slug that `graph resolve` turns into one. A name that matches more than one node is refused, never guessed" (catalog, Conventions). Nothing turns a name or a slug into a tapestryKey yet, so every input of the operations built so far that names a node takes a tapestryKey only: list-elements' `concept` and `set`, link-set's and unlink-set's `set` and `parent`, the `concept` of update-concept, mark-field, unmark-field and map-fields, the `from` and `to` of add-relationship and remove-relationship, and history's `node`.
- **Today's routes take a name and use the first match.** `POST /api/normalize/create-element`, for one, finds its concept by exact name, takes the first header it finds, and doesn't look at who wrote it. Those routes stay as they are (D15).
- **A name can name more than one node.** On this Mac's agent-memory instance (read only, 2026-11-16), six concept names each name two concept headers: the instance's own, and one by another author. `nostr relay` is also a header by `919ba08a…`, and `tag`, `nostr user tag`, `tag pinning`, `nostr event tagging` and `tagging with specific tag` are also headers by `82b75e47…`, the old local-dev assistant's key (ADR 0015). Neither author has a GrapeRank score there. Across the graph, 15 names are each held by two nodes.
- **Today's only lookup takes an address.** `GET /api/concept-graph/node/:handle` (not in /docs) takes a nostr address. A firmware concept's address is `39998:<assistant>:<d-tag>`, its d-tag usually its slug, so building one needs the instance's assistant key, which differs on every instance.
- **A concept's slug and its address can differ.** A concept has a slug, which create-concept finds it by and rule 10, `concept-slug-unique`, keeps unique among the instance's own concepts. It also has a d-tag, the last part of its address. They usually agree, but the firmware's `nostr-event-tag` concept has the slug `nostr-event-tagging`, and update-concept can change a slug and keep the address.
- **A node's name is defined once.** The read conventions (ADR graph-operations-first-slice/0011) answer a node with its name: its tapestryValue (D11), else its name. Today no node on the agent-memory instance has a tapestryValue yet, so names come from the name property, which the nostr import fills from an event's `name`, `names` or `title` tag. A concept header's `names` tag also holds its plural.
- **The read conventions apply.** A read that answers a list pages with `limit` and `cursor`; a read that can include other authors' nodes takes `pov`, the owner's by default; and a node is answered with its tapestryKey, name, address, author and whether it is the instance's own (ADR 0011, C1–C3). Reads stay behind sign-in (the book's frame).
- **Agents already have a way in.** The external CLI (A10.6) turns each operation the instance lists into a command, so this one reaches agents with no change to it.

## User-facing description

As an admin agent rebuilding or exploring a concept graph, or the owner, I want to give a concept's or a node's name, slug or nostr address and get back the tapestryKeys it could mean, so that I can name things as people do and still call the operations, which take tapestryKeys.

As the same agent, I want to be told when a name means more than one node, with each candidate and how it matched, so that nothing guesses for me.

As whoever builds the next operation, I want what a name or slug resolves to defined once, so that every input that names a node can take one and refuse it the same way when it's ambiguous.

## Acceptance criteria

- [ ] **AC1 — What a ref names** (open questions 1 and 2). Given the owner or an admin is signed in, when they call `GET /api/tapestry/graph/resolve` with `ref`, then the answer lists every node the ref names:
  - a tapestryKey names the node that has it;
  - a nostr address, as the graph records one (`kind:pubkey:d-tag`, or an event's id), names the node at that address, and so does its NIP-19 form (`naddr`, `nevent` or `note`);
  - a name names every node whose name is the ref, ignoring case and extra white space. A node's name is the one the read conventions answer. A concept header's plural counts too, so `dogs` names the concept dog;
  - a slug names every concept whose slug it is, and every node whose address ends in it (its d-tag). So `dog-breed` names the concept dog breed, and both `nostr-event-tag` and `nostr-event-tagging` name the concept nostr event tagging.

  A ref is read every way it can be: `dog` is both a name and a slug. A node found more than one way is listed once. With `kind=concept`, only concept headers are listed; with `kind=set`, only sets and supersets; with no `kind`, any node. A change entry is never a candidate.
- [ ] **AC2 — The candidates, and any ambiguity.** Each candidate comes with:
  - the five facts every read answers a node with (tapestryKey, name, address, author, own);
  - what kind of node it is: a concept header, a superset, a set, or another node;
  - how the ref matched it: by tapestryKey, address, name, plural, slug or d-tag.

  The answer gives the ref as it was read. It says whether the ref is ambiguous, meaning more than one candidate counts, and how many candidates were kept and left out, across the whole list. resolve never picks one: an ambiguous ref answers every candidate, and a ref that names nothing answers an empty list, not a refusal.
- [ ] **AC3 — From a point of view: the owner's, by default** (open question 3). With no `pov`, a candidate counts as list-elements' elements do: when it has no author, when its author is the instance's own, or when the owner's web of trust scores its author above the verified cutoff. The rest are left out and counted. So on an instance like the agent-memory one, `nostr relay` names one concept, the instance's own, and the answer says one other was left out. With `pov=everyone`, it names both and is ambiguous. Ambiguity is judged among the candidates the point of view keeps. Nothing about a point of view is stored. A `pov` the instance can't read from is refused, as list-elements refuses it.
- [ ] **AC4 — Page by page.** As every read's list does: at most `limit` candidates a page (1 to 200, 50 by default), in tapestryKey order, with a cursor for the next page that is null on the last. Passing each page's cursor in turn answers every candidate exactly once. A cursor that isn't one resolve gave for the same ref, the same `kind` and the same point of view is refused.
- [ ] **AC5 — What it refuses.** resolve refuses each of these, changes nothing, and says in words what was wrong, naming the input:
  - no `ref`;
  - a ref that is empty once trimmed, or holds a control character, a text-direction control or an invisible character that draws nothing where it is. These are the characters create-concept refuses in a name, since each can make a ref read as another, and the refusal names the character;
  - a `kind` other than `concept` or `set`, a `limit`, `pov` or `cursor` that isn't valid, and an input resolve doesn't take.
- [ ] **AC6 — A read, behind sign-in, that agents can use.** resolve writes nothing: no change, and no change entry. A caller who isn't signed in is refused with 401, and a signed-in person who is neither the owner nor an admin with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph resolve --ref <ref>` with no sign-in and gets the route's answers. On a scratch stack, an admin agent with its own key, through the external CLI (A10.6) with no change to the CLI, resolves a concept by its name, lists its elements with the tapestryKey it got back, and is told when a name it gives is ambiguous.
- [ ] **AC7 — Resolution, written once, for the operations that follow.** What a ref names, and when it is ambiguous, is defined once. So a later operation's input that names a node can take a name, slug or address and resolve it the same way, refusing a ref that names more than one node, or none, and naming the candidates. The catalog's Conventions ("Naming a node") say how. No operation built so far changes its inputs in this story.

Seven criteria, for one read. AC7 makes it the pattern for every input that names a node, and it adds no behavior of its own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- `39998:<TA>:concept-header` — concept header (read): `kind=concept` keeps only these, and a ref can be a concept's name, plural or slug.
- `39998:<TA>:superset` and `39998:<TA>:set` — superset and set (read): `kind=set` keeps only these.
- `39998:<TA>:word` — word (read): the word-wrapper every node's name and JSON follow (D9, D11).
- `39998:<TA>:nostr-event` — nostr event (read): a ref can be an event's address or id.
- `39998:<TA>:nostr-user`, `39998:<TA>:web-of-trust` and `39998:<TA>:graperank` — the owner's web of trust and its scores (read): what decides whether another author's candidate counts.
- Nothing in this story changes a firmware concept's definition.

## Out of scope

- **Changing the inputs of the operations built so far** to take a name, slug or address. Each adopts resolution when its own story asks for it, or one follow-up story widens them together.
- **Resolving within a concept,** such as an element's name among one concept's elements only. `graph search` (A10.8) takes `concept`, and a later story can add the same to resolve when an operation needs it.
- **Partial, fuzzy or near matches,** and finding nodes by text in their fields: `graph search` (A10.8). create-concept's near matches stay its own.
- **People:** a pubkey or an `npub` naming someone's nostr user node.
- **Points of view besides the owner's and everyone's,** as for list-elements.
- **Anything more about a candidate:** its fields, labels, concepts or relationships (`graph describe-node`, A10.10).
- **Today's routes that take a name and use the first match,** which stay as they are (D15).
- **Letting visitors read** (catalog §10, question 1).
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

To resolve at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved the story as drafted, with all three (2026-11-16).

1. **What a ref can be.** *Resolved, the drafting's proposal, approved by the owner (2026-11-16):* a tapestryKey; a nostr address as the graph records one (`kind:pubkey:d-tag`, or an event's id), or its NIP-19 form (`naddr`, `nevent`, `note`); a name, compared without regard to case or extra white space, a concept's plural included; and a slug, meaning a concept's slug or the d-tag of any node's address. AC1. Other choices: names compared exactly, case included; no plurals; a slug as a concept's slug only; addresses only as the graph records them, with no NIP-19 forms.
2. **Narrowing by kind.** *Resolved, the drafting's proposal, approved by the owner (2026-11-16):* an optional `kind`, `concept` or `set`, with any node when it's left out, and more kinds as the operations that take them are built. AC1. Why: a later operation's `concept` input should look for `dog` among concept headers only, so that an element named Dog in another concept doesn't make it ambiguous, and an agent can ask resolve the same way. The other choice: no `kind`, and callers sort the candidates by the kind each one names.
3. **Ambiguity, and the point of view.** *Resolved, the drafting's proposal, approved by the owner (2026-11-16):* the point of view decides which candidates count, and a ref is ambiguous when more than one of those does. AC3. So another author's untrusted concept named `nostr relay` doesn't stop the instance's own name from resolving, and the answer says it left one out. The other choice: a ref is ambiguous when it names more than one node by any author, whatever the point of view. That is stricter, but it would make every name another author reuses unusable as an input.

For Architecture, not this gate:

- **How names compare:** what "ignoring case" means beyond a–z; runs of white space; accents, which a slug drops and a name keeps.
- **A name with no letter a–z or digit 0–9,** such as another author's element named in another script. The drafting reads create-concept's "no slug" rule as one for making a concept's name, not for finding a node, so such a name resolves; the ADR confirms it.
- **What a lookup by name costs on a big graph.** No index covers names today, and staging holds about 370,000 of the trust pipeline's card sets beside the concept graph (ADR 0011, Amendment 2). Measure it on a scratch stack at staging's size.
- **How long a ref may be,** given that an address can be longer than a name.
- **Which nodes are never candidates** besides change entries, such as an event's tag nodes.
- **Where the shared resolution lives,** and how a later operation's input says it takes a ref, so that its command and its /docs entry say so too; what that input's refusals for an ambiguous ref and for none are called, and what they carry; and which point of view a write resolves its inputs from.
- **The names of the kinds in the answer,** in line with how list-elements reads a concept header, a superset and a set (ADR 0011, Amendment 2: a set has an address).

## Evidence

### The suites (Implementation, 2026-11-16, on `a3d689a0`)

Run one at a time on this Mac, each with every service endpoint dead (`test/helpers/graphOpsSuite.js`'s `childEnv`). No full `npm test` ran here: the local stack is the owner's agent-memory instance.
- **The new suites:**
  - `test/operations/graph/resolve.test.js`: 22 passed, 0 failed;
  - `test/operations/resolve.test.js`: 11 passed, 0 failed;
  - `test/operations/graph/resolve-agent-through-cli.test.js`: 2 passed, 0 failed;
  - `test/operations/graph/concept-names.test.js`: 5 passed, CN5 among them.
- **Every other suite under `test/operations/`** passed as before: its own six suites (F24, numbered F21 when it ran, among the fake's 22), the 20 under `graph/`, and the 5 under `rules/`, 31 in all with the new ones. `lifecycle/` was left out, as at Test Design.
- **harness-lint:** clean.

### The live check (Implementation, 2026-11-16, on `a3d689a0`)

This ran on a throwaway instance from `scripts/scratch-stack.sh`, never a shared or private one. Its scripts are kept outside the tree. Every call went through `test/helpers/scratchLoopback.js`, which refuses any container not named `tapestry-scratch…`.
- **The instance.**
  - It booted from image `agent-memory-tapestry` with this branch's `src/` mounted.
  - The image's firmware differed from the branch's (digests `c4c30295…` and `136f3af4…`), so the branch's was copied in and installed.
  - The branch's `bin/tapestry.js` was copied in and linked as `tapestry`, and `clients/cli` was copied in.
- **Keys.** The instance had its own assistant key. Four throwaway keys were made for the check: the owner's, an admin's for the agent, a peer's and a stranger's.
- **The calls** went through `docker exec` to `127.0.0.1:7778`, as the trusted local operator. The agent's, the stranger's and the visitor's went through the instance's nginx.
- **Afterwards** it was removed.

**The seed:**
- `live dog`, through today's create-concept route, which signs, with rex, fido and patch through today's create-element;
- the set `live walkers`, through today's add-subset, under live dog's superset;
- a peer's `live dog`, signed by the peer's key, put on the relay with `strfry import` and imported with `event-update`. The import labels it `ListHeader`, not `ConceptHeader`;
- `live cat`, through the operation `graph create-concept`: no event, and one change entry;
- a kind-30000 event by the peer at `30000:<peer>:live-dog`, and 120 nodes named `live item`, made with Cypher. `event-update` imports only the concept graph's kinds.

`dog breed` was meant to be the operation's concept. But the firmware ships a `dog breed` concept, so create-concept answered `already-exists` and wrote nothing, and the firmware's served for `kind=concept`. The relay held 450 events after the firmware install, and 462 after the seed.

**Three scripted checks failed, on the scripts' own expectations, and each was rechecked.** The first pass ran 54 checks and 52 passed; the second ran 10 and 9 passed.
- **The kind-30000 event by its address** (first pass).
  - The check asked from the owner's point of view, which leaves the event out: its author is scored 0.01. It answered `kept 0` and `leftOut 1`, which is right, but the script expected the event.
  - The second pass asked from both points of view, and both checks passed (AC3, AC1).
- **The stranger's refusal** (both passes).
  - The check looked for `not-allowed` or `403` in the external CLI's output. But the central check's body, `{"success": false, "error": "Only the owner or an admin can do this."}`, has no `code`, and the CLI prints no status, so neither could appear.
  - The refusal was rechecked by a call by hand through nginx (AC6, sign-in).

**By criterion:**
- **AC1: passes.**
  - **Names.** `live dog` named the instance's concept. `  Live   DOG ` named the same, answered as `ref: "Live   DOG"` and read as `Live DOG`. `live cat` named the operation's event-less concept.
  - **Plurals.** `live dogs` named both live dogs, and `live cats` named live cat, each matched `plural`.
  - **Slugs.**
    - `live-dog` named both live dogs, matched `slug` and `d-tag`. It didn't name the kind-30000 event at `30000:<peer>:live-dog`.
    - `live-cat` named live cat the same way.
    - `live-dog-superset`, a core node's d-tag, named live dog's superset, matched `d-tag`.
  - **Addresses.**
    - `39998:<assistant>:live-dog` named live dog, and so did the address with its pubkey in capitals (read in lowercase) and its naddr.
    - live cat's address named live cat.
    - `30000:<peer>:live-dog` named the kind-30000 event from everyone's point of view.
  - **An event's id.** The peer's event id named its concept, and so did its nevent and its note.
  - **A key.** live dog's tapestryKey named it, matched `tapestryKey`.
  - **Kinds.** `dog breed` with `kind=concept` named its one concept, and `live walkers` with `kind=set` named the set.
- **AC2: passes.**
  - Each candidate came with its kind and how it matched, as above. The suites check each one's five facts (RV9). The live check read the tapestryKey and name of each candidate, and the author and `own` of one: live cat, as the assistant's and the instance's own.
  - The peer's live dog came as a concept, though it is labelled `ListHeader` only.
  - The superset came as a superset, the set as a set, and the kind-30000 event as a node.
- **AC3: passes.**
  - **Before any score existed** (no `NostrUser` had an influence): `live dog` kept 1, the instance's own, and left the peer's out, with `scored: false`.
  - **With the peer's influence set to 0.2:** kept 2, ambiguous, `scored: true`.
  - **Then 0.01:** kept 1, left out 1, not ambiguous.
  - **The owner's own pubkey as `pov`** answered exactly as the default did.
  - **`everyone`:** both, ambiguous.
  - **The kind-30000 event,** by the peer at 0.01: kept 0 and left out 1 from the owner's point of view.
- **AC4: passes.**
  - `live item` paged 50, 50 and 20, each of the 120 once, in tapestryKey order. Every page said kept 120, and the last cursor was null.
  - A cursor from another ref was refused `invalid-cursor`.
- **AC5: passes.** Each refusal answered as the suites expect:
  - no ref: `missing-input`;
  - an empty ref, one of spaces, a control character (U+0007), a text-direction control (U+202E) and an invisible character (U+200B): `bad-ref`, naming the character;
  - a ref of 1,001 characters, `kind=property` and `limit=0`: `invalid-input`;
  - a stranger's pubkey as `pov`: `unknown-pov`;
  - an input resolve doesn't take: `unknown-input`.
- **AC6: passes.**
  - **The command.** `tapestry graph resolve` in the container printed the same JSON value the route answered. It indents it, where the route's body is compact, so the two match as values, not byte for byte. Its refusal exited 1 with the route's answer.
  - **The admin agent,** through nginx and the external CLI:
    - resolved `live dog` to one candidate from the owner's point of view (kept 1, left out 1);
    - listed that concept's elements with the key it got back (rex, fido and patch);
    - was told `live dog` is ambiguous from everyone's point of view, with both candidates;
    - resolved `live walkers` with `--kind set` to the set.
  - **Sign-in, through nginx.**
    - **A visitor** got 401.
    - **The stranger, through the external CLI.** Signed in with its own key, it ran `tapestry graph resolve --ref "live dog"`.
      - The CLI reads the operations list before any operation (`clients/cli/src/main.js:122–124`).
      - The list was refused. The CLI printed the central check's body and its own message, that the key is "neither its owner nor an admin", which it prints only on the list's 403 (`clients/cli/src/operations.js:32`).
      - It exited 1 without calling resolve.
    - **The stranger, by hand.** Called through nginx with the stranger's session cookie, resolve itself answered `HTTP 403` with `{"success":false,"error":"Only the owner or an admin can do this."}`. With the admin's session cookie it answered `live dog`'s candidates. This call's output wasn't saved with the scripts' result files, so it's quoted here as the session's tool output showed it.
    - **In the suites,** RV18 covers resolve's own 401 and 403.
  - **Nothing written.** In the first pass, the relay held 462 events and the graph 0 change entries before and after the resolve calls. In the second, after live cat, it held 462 and 1. Both held through the first timing run too.
- **AC7:** no live part; the suites cover it.

**The measurement** (ADR 0009, Consequences): a page by name, slug, address and key, the median of five each.

| Lookup | 3,507 nodes | 503,507 nodes, as the scratch stack boots | 503,507 nodes, with the agent-memory instance's four constraints |
|---|---|---|---|
| name (`live dog`) | 0.050 s | 0.636 s | 0.846 s |
| slug (`live-dog`) | 0.051 s | 0.974 s | 0.929 s |
| address (`39998:…:live-dog`) | 0.005 s | 0.451 s | 0.503 s |
| key | 0.005 s | 0.351 s | 0.005 s |

The 500,000 nodes had tapestryKeys and no names, as the card sets have, made with Cypher. Every page took under the ADR's 2 seconds, so no OPEN.md row is added.

**Found along the way:**
- **A fresh scratch stack has no constraint on `TapestryNode`, `NostrEvent` or `NostrUser`.** So a key there is found by scanning (0.351 s above). The agent-memory instance has `tapestry_key`, `nostrEvent_uuid`, `nostrEvent_id` and `nostrUser_pubkey`. With those four added to the scratch stack, the key took 0.005 s, the third column.
- **`TapestryNode`'s uuid is indexed** (`tapestry_node_uuid`), on the agent-memory instance and on the scratch stack. ADR 0009, Context 4 says no index covers it.
  - An address still scans, because family A's `n.uuid = $address OR n.id = $address` can't use that index alone.
  - Splitting the two halves would let one of them seek. It isn't needed under 2 seconds.
- **No node on the agent-memory instance has a name or tapestryValue that isn't text** (read only: 9,549 nodes, 450 named, none with a tapestryValue). `toLower` would fail a read by name or slug if one did. Every writer today writes text.

## Deviations

- **`resolveOne` decides by the page it reads.**
  - None on the page is refused `unknown-ref`, one gives its key, and more than one is refused `ambiguous-ref`. The count gives only the numbers the refusals state: how many nodes the point of view left out, and how many the ref names.
  - ADR 0009 Decision 5 decides by how many count, without saying which of its two statements answers that. Deciding by the page means a node added or removed between the two statements can't make `resolveOne` return no key, or call a single candidate ambiguous.
- **The live check compared the route and the command as values, not byte for byte.** The ADR's live check, step 3, says byte for byte. But the command indents its JSON, where the route's body is compact, so the two were parsed and compared as values (Evidence, AC6).
- **When the point of view left nothing out, `unknown-ref` says the ref names no node of the graph,** rather than giving a count of zero. Amendment 1, item 6, has the message give the number left out.
- **`candidatesOf`'s rows carry `byKey` and `byAddress`.**
  - They are set in JavaScript from the reading's family, beside the `byName`, `byPlural`, `bySlug` and `byDTag` columns that family N's page returns.
  - So `candidateOf(row, own)` reads every way a node matched from its row alone, as the ADR's signature has it. The statements of families K and A stay as Decision 3 gives them.
- **`run` checks its limit again,** as list-elements' does, and so does `candidatesOf`. A limit that isn't a whole number from 1 fails with a 500, though the input's schema refuses one first.
- **`bad-ref` quotes the ref as given, cut to 60 characters, as create-concept quotes a name** (ADR 0009 Decision 1's example). A ref that holds a text-direction control is quoted with the control in it, as a name is in create-concept's `bad-name`. The refusal's words also name the character by its code point.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild and "Reads stay behind sign-in" bullets)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D6, D11, D13, D15); [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md) (Conventions, §1, §10 question 1)
- The read conventions this read follows: [11-list-elements.md](11-list-elements.md); [ADR graph-operations-first-slice/0011](../../decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md)
- A concept's names and slug, and rule 10: [16-create-concept-and-update-concept.md](16-create-concept-and-update-concept.md); [ADR graph-operations-first-slice/0016](../../decisions/graph-operations-first-slice/0016-create-concept-and-update-concept.md)
- What counts as a set: [ADR graph-operations-first-slice/0028](../../decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md), Amendment 3
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0009-resolve-and-naming-a-node.md](../../decisions/graph-operations-first-slice/0009-resolve-and-naming-a-node.md)
- Test plan: [9-resolve.test-plan.md](9-resolve.test-plan.md)
- Review: [engineering-team/reviews/graph-operations-first-slice/9-resolve.md](../../reviews/graph-operations-first-slice/9-resolve.md)
