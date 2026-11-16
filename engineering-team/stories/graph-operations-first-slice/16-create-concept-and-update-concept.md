# Story 16: `graph create-concept` and `update-concept` — make a concept with no event, and change its names, slug or description

**Status:** Done
**Created:** 2026-11-15
**Type:** Feature
**Loom:** A10.16 — https://loom.brainstorm.world/t/A10.16

## Background

Loom's A10.16 asks for two graph writes (catalog §2, Concepts):

- **`graph create-concept`:** "a concept with its eight core nodes and their wiring (BIBLE §9), with no event", taking `name`, `plural?` and `description?` and answering "the header's and core nodes' tapestryKeys; safe to repeat by slug". It "refuses a slug another concept uses (BIBLE §10, rule 10)".
- **`graph update-concept`:** "change a concept's names, slug or description", taking the concept and the fields and answering the concept. It "refuses a slug in use".

The task asks the spec to settle two things. First, "the catalog refuses a slug already in use, while A9's contract returns an existing concept untouched and says so, reporting near matches (memos #75 and #79 on A9.4); the spec picks one." Second, Avi's brain "asks that create-concept offer an existing shared concept, and that names be trimmed" (his comment on nousclawds4/tapestry#32).

Done, for Loom, is when "each is declared once; answers at `/api/tapestry/graph/<operation>` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI." These are the first two concept writes of the book's rebuild (A10.39): every concept in Avi's brain is made by one of them.

Ten facts about today's instance shape the story:

- **One written rule keeps concepts apart, and none keeps names apart.** BIBLE §10's rule 10 reads "Concept slugs MUST be locally unique". Its full text is in the owner's tapestry-cli repo (`docs/NORMALIZATION.md`, last changed 2026-03-23), not in this one. It holds the rule within one author's graph, because the slug is the key each element's JSON is filed under (`{"dog": {…}}`), and two concepts sharing it would break that. The same slug from two authors is expected, and the Grapevine settles it (rule 8). In that text the slug is the camelCase key (`irishSetter`), which today's code keeps as `oKeys.singular`, beside a kebab-case slug (`irish-setter`). No rule makes names unique: the owner's draft core rules say a node's tapestryValue, its name, "does not need to be unique" (design §7).

- **Today's create-concept signs ten events.** `POST /api/normalize/create-concept` signs the header and its seven core nodes, signs the core nodes graph and the concept graph again once their addresses are known, stores each event in the instance's relay, and builds the nodes from them (`src/api/normalize/index.js`, `handleCreateConcept`). It refuses a name the instance's assistant has used before unless the caller sets `overwrite`, and answers that refusal with `success: false` and status 200. `POST /api/normalize/skeleton` signs the core nodes a concept is missing; the catalog sends it to `rules repair`.
- **Today's set-slug signs too.** `POST /api/normalize/set-slug` finds the concept by name, taking the first match, refuses a slug another header uses, and signs the header again with the new `slug` tag. Nothing changes a concept's names or description without signing: the Dictionary's edit (`POST /api/dictionaries/concepts/edit`) signs a new version of the header.
- **A rule for renames already exists.** The Dictionary's edit (the owner's request of 2026-10-02, `src/lib/conceptHeaderEdit.js`) changes a concept's names and description and keeps everything else. Its slugs, key and labels are "identities (the derived graph's slug, schema keys, Neo4j labels)", and its address never changes, "so its items and anything wired to it keep pointing at it". It refuses to rename the concepts the server finds by their name, and a name another of the assistant's concepts already has.
- **A concept's key holds its elements' data.** Each element keeps its data under the concept's key (`oKeys.singular`, such as `dog`). The concept's JSON Schema is made from that key, and so is each field mark's node property, `<concept key>_<field>` (ADR graph-operations-foundation/0005). A key that changed would leave all three behind.
- **One write makes nodes with no event.** add-subset gives its event-less sets the address a letter would have, the tag nodes the import would have made, and no `NostrEvent` label (ADR node-primitives/0001; ADR graph-operations-foundation/0003, Decision 9). So every read that works for a lettered set works for one of these, and a letter published for it later lands on the same node.
- **Many of today's routes find a concept by name, among nodes that came from an event.** Seventeen lookups in `src/api/normalize/index.js` match `(h:NostrEvent) … h.name = $…`: create-element's, skeleton's, create-property's, generate-property-tree's and save-schema's among them, and today's create-concept's own check for a name it has used. The UI's concept list (`ui/src/pages/concepts/ConceptList.jsx`) also lists only headers that came from an event. None of them will find a concept that has no event. The concept-graph reads (`/api/concept-graph/summaries`, and `node`, `neighbors` and `core-nodes` by address) find concept headers by label and by address, so they will.
- **The write path is built.** A10.4 gives a graph write its guards, one transaction with its change entry, and no signing (ADR graph-operations-foundation/0004). Every node it makes gets a tapestryKey under the shared label (A10.3).
- **Agents already have a way in.** The external CLI (A10.6) turns each operation the instance lists into a command, so these two reach agents with no change to it.
- **Firmware concepts are rebuilt on reinstall.** A firmware install rebuilds each firmware concept's header from its built-in definition (OPEN.md row 8).

## User-facing description

As an admin agent rebuilding a concept graph, or the owner, I want to make a concept, with its eight core nodes, without signing anything, so that the graph's concepts can be made privately, and a step that failed partway can simply be run again.

As the same agent, I want to be told when the concept I asked for already exists, here or as someone else's shared concept, so that I don't make a second one, and don't assume my description was saved when it wasn't.

As the same agent, I want to change a concept's names, slug or description without signing, and without its elements, its schema or its field marks being left behind.

## Acceptance criteria

- [ ] **AC1 — Create a concept.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/create-concept` with `name`, and optionally `plural` and `description`, then the graph holds a new concept: its header and its seven other core nodes (superset, JSON schema, primary property, properties set, property tree graph, concept graph, core nodes graph), wired to each other as today's create-concept wires them. Each of the eight is an element of a concept (D9), has a tapestryKey under the shared label, has its name as its tapestryValue (D11), and carries no `NostrEvent` label (D7). Left out, the plural is the name with an `s`, as today. The answer gives the header's tapestryKey, each core node's by its role, and the change entry. Nothing is signed or sent to a relay.
- [ ] **AC2 — It reads like a concept today's route makes.** The new concept has the names, slugs, key, description and word-wrapper JSON (BIBLE §8) that today's create-concept gives the same name and plural, and each node has an address a letter for it could carry. The concept-graph reads show it: `summaries` lists it, and `node`, `neighbors` and `core-nodes` by its address give its header, its wiring and its eight core nodes. `graph history` finds its entry by any of its nodes.
- [ ] **AC3 — Safe to repeat by slug: an existing concept is returned untouched.** Given one of this instance's own concepts already has the slug that the input's name gives (whichever made it: this operation, today's create-concept or the firmware), when create-concept is called, then it changes nothing, records nothing, and answers `already-exists` with that concept's tapestryKeys and what it holds: its names, slug and description. It names each input that differs from what the concept holds, so an agent doesn't assume its plural or description was saved (Avi, memo #79). Two calls at once with the same name make one concept.
- [ ] **AC4 — Near matches and shared concepts are reported, never refused.** Every create-concept answer lists the other concepts in the graph that are close to the one asked for: another author's concept with the same slug or name, such as a shared concept the instance has imported (Avi's ask); another of this instance's own concepts with the same name; and any concept whose singular is the plural asked for, or whose plural is the singular. Each comes with its tapestryKey, address, names and author, and whether it is this instance's own. The list is capped, and says when there were more. None of them stops the create.
- [ ] **AC5 — Names are trimmed and checked.** Both operations trim each name, and turn each run of white space inside it into one space, before using it (Avi's ask). They refuse, naming the input and changing nothing: a name that is empty once trimmed; one whose slug would be empty, such as `!!!`; one with control characters or text-direction controls (as the Dictionary's edit refuses); and one longer than 200 characters, which is refused rather than cut.
- [ ] **AC6 — Update a concept.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/update-concept` with `concept` (its header's tapestryKey) and any of `name`, `plural`, `slug` and `description`, then the concept holds the new values. Its names, and the titles and core-node names made from them, follow a rename; its tapestryValue follows its singular name (D11). Its key, labels, address and tapestryKeys stay as they were, as the Dictionary's edit keeps them, so its elements, schema and field marks go on working. After a slug change, create-concept finds the concept by its new slug, and no longer by its old one. A create with the name the concept was made with is refused while this concept keeps the key that name gives (`key-in-use`, AC7), since a concept's key never changes; another name that gives the old slug but not the old key makes a new concept, though the address that name gives belongs to the old one. The answer gives the concept as it now is, what changed, and the change entry. Given values it already holds, it changes nothing, records nothing and answers `unchanged`. Nothing is signed or sent to a relay.
- [ ] **AC7 — What update-concept refuses, and the rule behind both operations.** update-concept refuses each of these, changes nothing, records no entry, and says in words what was wrong:
  - a `concept` that names no concept header;
  - a slug that another of this instance's concepts has, naming that concept;
  - a concept that isn't this instance's own: one that came from another author's event (D4);
  - a firmware concept, which a reinstall would rebuild (lifecycle seed-firmware, A10.37, is how those change);
  - a new singular name for one of the concepts the server finds by name, or a new singular name that is one of those names, as the Dictionary's edit refuses both. *(Ruled at Review, 2026-11-15: the owner's answer to review round 1's non-blocking 5, which found only the first refused.)*
  - a call that names no field to change.

  The rule behind it is rule 10 as its full text gives it: no two of this instance's own concepts share a slug, or a key, since the key is what the rule keeps elements' JSON apart by. It holds for both operations. create-concept refuses a name whose key another of this instance's concepts already has under a different slug, naming that concept; a concept with the same slug is the repeat (AC3). The rule is defined once: as both operations' guard, and, run over a set of concepts, as a check that names each concept breaking it, for `rules check` (A10.31). It is written into the rules document (`docs/GRAPH_RULES.md`) with what it says, that it refuses a write, and how a check finds what breaks it. Names are not part of it: no rule makes them unique.
- [ ] **AC8 — It lasts, and it reaches agents.** A concept made or changed by these operations is as it was after a firmware reinstall, and after a backup restored on a fresh instance (BIBLE §30). Both operations are for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. Each is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph create-concept --name <name>` and `tapestry graph update-concept --concept <key> …` with no sign-in and gets the route's answers, and their entries name the command as who made them. An admin agent with its own key creates a concept, creates it again, and renames it, through the external CLI (A10.6) with no change to the CLI.

Eight criteria, covering two operations that share a rule and a reading of names. They stay one story because Loom pairs them and the rule is one. If the change proves too big to review in one sitting, update-concept (AC6 and AC7) can become a story of its own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- `39998:<TA>:concept-header` — concept header (read; its elements are concepts). Each new header becomes one of its elements (D9).
- `39998:<TA>:superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph` — the well-known core-node concepts (read). Each new core node becomes an element of its own, as today's create-concept makes it.
- `39998:<TA>:word` — word (read). The word-wrapper JSON's `word` block (BIBLE §8).
- Nothing in this story changes a firmware concept's definition.

## Out of scope

- **Pointing to an existing shared concept** in place of making one, such as adopting another author's concept as this instance's. The answer reports them (AC4); acting on one belongs to the shared-concepts app layer (catalog §9: `normalize/adoption-disposition`, `self-declare`, `b-append`, `b-defer`).
- **Changing a concept's key, labels or address,** which would mean moving every element's data, its schema and its marks. That is a later operation, if one is needed.
- **Today's routes and the UI's concept list,** which find a concept by name among nodes that came from an event and won't find these concepts (D15: today's tools aren't brought up to code). Until `graph add-property` (A10.18) and `graph create-element` (A10.20) land, a concept made here gets its properties and elements from no route. Today's signing routes are left unable to find it on purpose: a letter one of them signed would point at a concept that has none.
- **Publishing a concept** as nostr events (`export nostr`, A10.34). A concept made here is a private thought until then (BIBLE §30).
- **`graph delete-concept`** (A10.17), and **properties and the schema** (A10.18): create-concept makes the schema node and the primary property as today's route does, and nothing more.
- **A concept made from a firmware definition,** which stays with firmware install, and lifecycle seed-firmware (A10.37).
- **Bulk creates** (catalog §10, question 6): one concept per call.
- **Today's create-concept, skeleton and set-slug routes,** which stay as they are (D15).
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate.

1. **Refuse a used slug, or return the existing concept?** *Resolved: return it untouched, as A9's contract does* (memos #75 and #79 on A9.4; the owner's answer, 2026-11-15). One of this instance's own concepts with the same slug is the same write, so create-concept answers `already-exists`, says what the concept holds and which inputs differ, and is safe for an agent that reruns a step. Near matches and other authors' concepts are reported, never refused (AC3, AC4). The catalog's refusal of a slug in use belongs to update-concept (AC7).
2. **Must names be unique?** *Resolved: no* (the owner's answer, 2026-11-15). No written rule makes them so (design §7), so the repeat is by slug alone and a concept with the same name is reported as a near match (AC3, AC4). The rule both operations hold is rule 10, for slugs and keys (AC7).
3. **What does a rename change?** *Resolved: what the Dictionary's edit keeps stays* (the owner's request of 2026-10-02, and his answer, 2026-11-15). The names, the titles and core-node names made from them, the slug the concept is found by, and the description follow; the concept's key, labels, address and tapestryKeys don't, so elements, the schema and field marks are never left behind (AC6).
4. **Which concepts may update-concept change?** *Resolved: this instance's own, with or without a letter, except firmware concepts and the name-keyed renames* (the owner's answer, 2026-11-15; AC7). For a concept that has a letter, the change is the node first, the letter later on purpose (D2): the answer says the letter no longer matches, and `export nostr` (A10.34) is what sends a new one.

**Corrected at Architecture** (the owner's approval, 2026-11-15, with ADR 0016): AC6's last sentence first said a create with a concept's old name makes a new concept once its slug changes. Under AC7's rule, a concept's key never changes, so a create with the name the concept was made with is refused (`key-in-use`) while the concept keeps that name's key.

For Architecture, not this gate:

- **How a node with no event is made, once for every operation that makes one.** create-set (A10.27) and create-element (A10.20) start from this ADR and build on it (the A10.5 session's coordination notes, sent at the owner's request, 2026-11-15). It settles three things:
  - the node's tapestryKey (`keyNode`, ADR graph-operations-foundation/0003 Decision 8), its labels with no `NostrEvent`, and its name (D11);
  - where its facts and JSON are kept: as add-subset keeps a set's, with the tag nodes an import would make, which every reader of today's reads, `_fields.js` included; or as properties and edges only (design D9, drafting, not confirmed), which today's readers can't read;
  - the statements the fake graph learns for making nodes, which those stories reuse.
- **Addresses:** which address each node gets, and what create-concept does when the address a name would give is already held, as by a concept whose slug was changed (AC6).
- **Which concepts are "this instance's own"** for the slug and key rule: those under the assistant's address, lettered or not, and how a concept the owner signed with their own key counts.
- **Near matches:** how close is close (AC4), and the cap.
- **What a letter that no longer matches means** when today's import brings the old letter in again, and how the answer says it (open question 3).
- **The change entries' shape** for a concept made (eight nodes, eleven or so edges) and a concept changed (each field, from and to).

## Evidence

### The live check (Implementation, 2026-11-15)

This ran on a throwaway instance from `scripts/scratch-stack.sh`, booted from image `agent-memory-tapestry` with this branch's `src/` mounted, and never on a shared or private instance. Every step and number is in the test plan's Verification. By criterion:

- **AC1 and AC2: pass.**
  - Today's create-concept made tea house, and `graph create-concept` made coffee house.
  - The concept-graph reads show coffee house: `summaries` lists it, `node` gives its labels with no `NostrEvent`, and `neighbors` its wiring.
  - All eight of `core-nodes`' nodes are identical to tea house's once the names are swapped.
- **AC3: passes.**
  - `graph create-concept` asked for tea house answered `already-exists`, `hasLetter` true, with no entry.
  - Two creates of moth at once made one concept and one entry: the lock held.
- **AC6 and AC7: pass on the instance too.** A rename of lamp to light, and a description on the lettered tea house (`letterOutOfDate` true), each answered as the suites do. Repeating them answered `already-exists` or `unchanged`.
- **AC8: passes.**
  - A backup was restored on a fresh instance. It brought back the assistant, and five concepts with every node, tag, relationship and tapestryKey as they were.
  - An admin agent, through nginx and the external CLI, created reading lamp, created it again and renamed it. Each change was recorded as the agent's.
  - The relay held 450 events before the first write, and 458 after the last. All 8 came from today's create-concept, and none from a graph operation.
  - **A reinstall:** the first live run wired Decision 3's memberships, and a reinstall pruned 11 of them (Amendment 2, below). Re-checked on a fresh instance with Amendment 2's wiring, a reinstall (69 s) left a created concept and a renamed one exactly as they were: nodes, tags and relationships. Every concept each node's `z` tags name still reached it through its class thread.

## Deviations

- **Memberships are what a reinstall leaves** (ADR 0016 Amendment 2, the owner's ruling at Implementation). The live check's first reinstall pruned 11 of the 21 memberships Decision 3 wired: `word` everywhere, `graph` on the graph nodes, and `set` on the properties set. A second reinstall changed nothing. The class threads still reached every node from each concept its `z` tags name. create-concept now wires the 10 memberships a reinstall leaves, and CC2 expects exactly those.
- **Two Tester corrections at Implementation,** each in a commit of its own, outside the implementation's:
  - CC3 expects a new concept's schema to read as wrapped. Today's route makes a schema whose only top-level key is the concept's key, which `conceptOf` reads as wrapped, and CC3 had asserted the opposite.
  - The seed's lettered concept is beagle, not dog. The active firmware has a dog concept at `39998:<TA>:dog`, so a seeded dog sat at a firmware concept's address, and update-concept rightly refused it (UC2).
- **`differs` compares the plural and the description only when they are given** (AC3: "each input that differs"). A repeat that names only the name never reports the plural it didn't give.
- **An update entry's `was` and `now` for the description are the description tag's**, null when there is none, not the JSON's default for a concept made without one.
- **The near-match read takes at most 500 candidates by name or slug before it sorts them** (`LIMIT 500` in C8). `moreSimilar` counts within those. A graph with more than 500 concepts sharing a name with the one asked for would under-count; it caps the read, which an unbounded scan wouldn't.
- **The rename writes node and tag values through the field mapping's S8 statement**, `_fields.js`'s `writeCopies`, reused rather than repeated: tag nodes carry keys too.
- **What review round 1 changed** (ADR 0016 Amendment 3), with the review's cases added first as a third Tester correction, in a commit of its own:
  - **A rename of a concept whose `names` tag has no plural lands,** and the same rename again answers `unchanged` (UC8). Before, it kept the old singular and recorded an entry each time.
  - **A bad name, plural or description is refused before the rule reads the graph** (CC20, UC9), as Decision 2 says. A refusal that needs the graph, such as `firmware-concept`, still comes after the rule's `slug-in-use`.
  - **AC5's list is one longer: an invisible character is refused** (CN3, CC11b, CC22), naming its code point. A name holding one reads as another, while its slug, key and labels hold the character, so `cat` with a variation selector after it would have been made beside cat (review round 2, ADR Amendment 4). The exceptions are a zero-width joiner or non-joiner between two letters of a script other than Latin, or two emoji, and a presentation selector after an emoji. Keycap emoji and tag-sequence flags are refused, and a joiner between two letters of a script that doesn't join passes. A name with no slug is now refused for having "no letter a–z or digit 0–9", which is what a name in another script lacks.
  - **A rename onto a name the server finds a concept by is refused `name-keyed`** (UC10), as the Dictionary's edit refuses it: the owner's ruling, now in AC7. create-concept is unchanged: a repeat by slug returns the instance's own concept.
  - **Two counts are checked:** each relationship create-concept makes must find its two nodes, and an update must write every node and tag it means to.
- **Known limits carried forward:**
  - **A concept can't be named in a non-Latin script alone,** since a slug keeps only a–z and 0–9 (Decision 2). Noted on Loom for the rebuild (A10.39).
  - **The re-check after the lock is pinned by no test.** The fake has no concurrency, and L2 is answered without it. The test plan's L7 is for the next scratch run that touches concepts.
  - **A create reads every own concept three times** (the guard, the re-check and the repeat). That is fine at today's size; noted on Loom for the rebuild, which makes many in a row.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild bullet)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D2, D4, D6, D7, D9, D11, D15); catalog §2, Concepts
- The write path these go through: [stories/graph-operations-foundation/4-the-write-path.md](../graph-operations-foundation/4-the-write-path.md)
- The field marks a rename must keep: [stories/graph-operations-foundation/5-field-mapping.md](../graph-operations-foundation/5-field-mapping.md)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0016-create-concept-and-update-concept.md](../../decisions/graph-operations-first-slice/0016-create-concept-and-update-concept.md)
- Test plan: [16-create-concept-and-update-concept.test-plan.md](16-create-concept-and-update-concept.test-plan.md)
- Review: [engineering-team/reviews/graph-operations-first-slice/16-create-concept-and-update-concept.md](../../reviews/graph-operations-first-slice/16-create-concept-and-update-concept.md) (rounds 1–2, 2026-11-15)
