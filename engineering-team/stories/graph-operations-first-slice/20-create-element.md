# Story 20: `graph create-element` — make an element of a concept, or of a set in its class thread, with no event and with its fields checked against the concept's schema

**Status:** Approved
**Created:** 2026-11-16
**Type:** Feature
**Loom:** A10.20 — https://loom.brainstorm.world/t/A10.20

## Background

Loom's A10.20 asks for one graph write (catalog §2, Nodes):

- **`graph create-element`:** "a node that is an element of a concept, or of a set in its class thread", taking `concept` or `set`, `name` and `fields`, and answering "the tapestryKey; safe to repeat by name within the concept". It "refuses fields that don't validate (BIBLE §10, rule 4), and a set outside the concept's class thread".

Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/create-element` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI." It is the rebuild's element write (A10.39): every element of Avi's brain is made by it, after create-concept (A10.16) has made its concept and create-set (A10.27) its sets. It is also the first write to check an element against its concept's schema, which `graph update-node` (A10.21), `graph add-to-concept` (A10.22) and the property operations (A10.18) will check again.

Eleven facts about today's instance shape the story:

- **Today's create-element signs, and never checks the element.** `POST /api/normalize/create-element` (`src/api/normalize/index.js`, `handleCreateElement`) finds the concept by name among headers that came from an event, taking the first match. It refuses a name an element of the concept's class thread already has, with `success: false` and status 200. It takes the caller's JSON, or makes one from the schema's top-level properties with empty values. For a concept today's create-concept made, that is `{"<key>": {}}`, which its own schema doesn't accept. Its d-tag is the name's slug and an eight-character hash of the header's address (`dtag.childDTag`). It signs the tags `d`, `name`, a `z` for the header and one for each shared concept the header's `b` tags point to, and `json`; stores the event in the instance's relay; builds the node from it; and links the concept's superset to it. It checks the JSON against nothing, and it can't put an element in a set: today's add-to-set signs the element again to add the `n` tag that names the set (BIBLE §23).
- **Nothing checks an element against its schema when it is written.** The derive step checks afterwards: for each node, it checks the node's JSON against the schema of every concept whose class thread reaches it or whose header a `z` tag names, and keeps the verdict in the node's cached JSON (`graphContext.parentJsonSchemas`, `src/lib/derivers/word.js`). The Health Audit does the same for a concept's core nodes. Both drop the schema's `$schema` and check with ajv, its strict mode off. Nothing in `src/operations/` checks fields yet.
- **The rule is written, but not as a rule of the rulebook.** BIBLE §10's rule 4 reads "Elements MUST validate against their concept's JSON Schema". The owner's D9: "each node is an element of at least one concept, and each node must validate against the expected format, as defined by that concept (typically as defined by that concept's JSON Schema)". D4 holds guards to the owner's and admins' own writes, not to imports. The rulebook (`docs/GRAPH_RULES.md`) has six rules, and none of them is rule 4.
- **What a concept's schema asks of its elements.** The schema today's create-concept writes, and `graph create-concept` copies, asks for a section under the concept's key holding a `name`, a `slug` and a `description`, each text, and marks `name` and `slug` unique (`x-tapestry.unique`, which is advisory: only one of today's routes enforces it, for its own concept). So every element of such a concept needs all three. A firmware schema can ask more: dog's needs a `word` block, and ties `dog.breed` to `word.wordTypes`, so its element rover lists `goldenRetriever` there.
- **An element's JSON is word-wrapper JSON.** It is namespaced by concept key (`{"dog": {"name": "Fido", …}}`), so one element can carry sections for several concepts, and the word-wrapper format gives a node a `word` block naming it (tapestry-concepts.md), as newly authored tapestry elements carry (BIBLE §6). Under D10, which concepts a node belongs to is its edges, and `wordTypes` is computed from them.
- **Sets.** An element in a set has a link from the set (`HAS_ELEMENT`), and its own letter claims it with an `n` tag naming the set (class-thread-relationships.md). A node is an element of every concept whose class thread reaches it (rule 3). A set can sit under more than one parent, and link-set can put one concept's superset under another's, so an element in such a set belongs to more than one concept, each with its own schema.
- **One write makes nodes with no event.** `_eventless.js`'s `makeNode` (ADR graph-operations-first-slice/0016 Decision 1) makes the node the nostr import would make of the letter a write would sign, with no event: the letter's address, would-be tag nodes and no `NostrEvent` label. So every reader of an imported node reads it, and a letter published for it later lands on the same node.
- **Marked fields go on the node.** A concept can mark fields its elements carry as node properties, `<concept key>_<field>` (A10.5). `_fields.js`'s `mapNodes` is what every element write calls on the nodes it wrote, inside its own write, and it returns the copies for that write's change entry (ADR graph-operations-foundation/0005 Amendment 2.7). Today's signing element writes don't call it; that is A10.5.a.
- **A firmware reinstall adds element links.** Its pass 1d links each concept's superset to every node whose `z` tag names the concept's header. It then takes out such a direct link for firmware concepts when the node is also below the superset through a set, and pass 3's wire-implicit-elements wires and takes out links in the same way, for every concept (`src/firmware/install.js`; `handleWireImplicitElements`).
- **Command lines make no objects.** Both CLIs turn a command line's text into an operation's inputs with ajv's coercion, which makes numbers, true and false, and lists, but never an object (`src/operations/inputs.js`; the external CLI's `clients/cli/src/operations.js`). No operation takes an object input yet.
- **Rules reach the graph through firmware.** A rule is an entry in the rulebook and a file of code; `node src/firmware/graph-rules.js` makes each entry an element of the graph rule concept, which firmware installs on every instance (A10.41, on staging since PRs #81 and #86).

## User-facing description

As an admin agent rebuilding a concept graph, or the owner, I want to make an element of a concept, or put it straight into one of the concept's sets, with its fields, without signing anything, so that a graph's elements can be made privately, and a step that failed partway can simply be run again.

As the same agent, I want fields that don't fit the concept's schema refused, with every field that is wrong and why, so that every element the operations make is one each reader of the concept can read, and I can fix my input in one try.

As the same agent, I want to be told when the element I asked for already exists in the concept, and what differs from what I gave, so that I don't make a second one, and don't assume my fields were saved when they weren't.

## Acceptance criteria

- [ ] **AC1 — Make an element of a concept.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/create-element` with `concept` (a concept header's tapestryKey), `name`, and `fields` (the concept's fields, as an object), then the graph holds a new node: an element of the concept, directly under its superset. It has a tapestryKey under the shared label, its name as its tapestryValue (D11), and no `NostrEvent` label (D7). It has the address and tags a letter for it would carry: the address today's create-element gives the name and concept, and the tags `d`, `name`, a `z` naming the concept's header, and `json`. Its JSON is word-wrapper JSON: a `word` block naming it, whose `wordTypes` lists `word` and the key of each concept it is an element of, and the concept's section, under the concept's key, holding its name, the slug its name gives, and the fields given. The name is trimmed and checked as create-concept checks a name. The answer gives the element's tapestryKey and address, the concept, `outcome: created`, and the change entry, which `graph history` finds by the element or by the concept. `graph list-elements` lists it among the concept's elements. Nothing is signed or sent to a relay.
- [ ] **AC2 — In a set.** Given `set`, the tapestryKey of a set or superset in the concept's class thread, the element goes directly in that set, not under the superset, and its would-be `n` tag names the set. It is an element of the concept through the class thread, and of every other concept whose class thread reaches the set; its `wordTypes` and the answer list each one.
- [ ] **AC3 — Its fields are checked against the concept's schema (rule 4).** Before anything is written, the element's JSON, as AC1 makes it, is checked against the concept's JSON Schema. JSON that doesn't fit is refused (`invalid-fields`): nothing changes, no entry is recorded, and the refusal lists every problem, each naming the field and what is wrong (a required field left out, a value of the wrong type, a value the schema doesn't allow, a field the schema doesn't take). No value is made up for a field the caller left out (open question 3). A concept whose schema is missing, or can't be read, is refused (`no-schema`), since nothing could be checked. For each other concept the element joins through its set, the answer says whether its JSON fits that concept's schema too, and lists the problems; those don't stop it (open question 2).
- [ ] **AC4 — Safe to repeat by name within the concept.** Given one of this instance's own elements of the concept, anywhere in its class thread, already has the slug the name gives, create-element changes nothing, records nothing, and answers `already-exists` with that element. It names in `differs` each input that differs from what the element holds: the name, the set (when one is given and the element isn't directly in it), and each field given whose value differs. Two calls at once with the same name make one element. Another author's element with that name isn't a repeat: this instance's own is made beside it.
- [ ] **AC5 — What it refuses.** create-element refuses each of these, changes nothing, records no entry, and says in words what was wrong, naming the input:
  - a `concept` that names no concept header, and one with no superset (BIBLE §10, rule 1);
  - a `set` that names no node, one that is neither a set nor a superset, and one outside the concept's class thread, naming the concept;
  - a name that is empty once trimmed, has no slug, has a control, text-direction or invisible character, or is longer than 200 characters, as create-concept refuses a name;
  - `fields` that aren't an object, or that give a `name` or `slug` other than the ones the name gives;
  - JSON that doesn't fit the concept's schema, and a concept with no schema (AC3).

  A concept of any author takes an element: an element of another author's concept, such as a shared concept, is this instance's own claim that it belongs there, and each point of view weighs it (CLAUDE.md principle 2). A firmware concept takes one too, such as a relationship type of the owner's own.
- [ ] **AC6 — Marked fields go on the node.** For each field the concept marks (A10.5), the new element's node carries its value as `<concept key>_<field>`, in the same write, and the change entry records those copies as the field mapping's writes record them.
- [ ] **AC7 — Rule 4, defined once, and one check for every element write.** Rule 4 becomes a rule of the rulebook: an element's JSON fits the JSON Schema of its concept. It is defined once: as create-element's guard and, run over a set of elements, as a check that names each element, and each of its concepts whose schema it doesn't fit, for `rules check` (A10.31). It is written into `docs/GRAPH_RULES.md` in the rulebook's format, and so becomes an element of the graph rule concept (A10.41). The check it uses is one shared piece, which `graph update-node` (A10.21), `graph add-to-concept` (A10.22) and the property operations (A10.18) use when they are built.
- [ ] **AC8 — It lasts, and it reaches agents.** After a firmware reinstall, and after a backup restored on a fresh instance, an element made by this operation keeps its tags, its JSON and its node properties, and is an element of the same concepts and sets (BIBLE §30). The operation is for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph create-element` with no sign-in, passing `fields` as JSON text, and gets the route's answers, and their entries name the command as who made them. On a scratch stack, an admin agent with its own key makes an element, makes it again, makes one in a set, and is refused fields that don't fit, through the external CLI (A10.6) with no change to the CLI.

Eight criteria for one operation. AC7 is the shared check the later element writes reuse; it stays here because the operation can't refuse a field without it. If the change proves too big to review in one sitting, the rule's check over existing elements (AC7's second use) can become a story of its own, ahead of `rules check`.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- Any concept, by its header (read): its header, superset and JSON schema are read, and the new element joins it.
- `39998:<TA>:superset` and `39998:<TA>:set` — superset and set (read): `set` may be either.
- `39998:<TA>:neo4j-property` — neo4j property (read): its first set holds the marks AC6 carries.
- `39998:<TA>:graph-rule` — graph rule (firmware, written by `node src/firmware/graph-rules.js`): rule 4's entry becomes one of its elements. A firmware install brings the new element to each instance (ADR graph-operations-first-slice/0041).
- No other firmware concept's definition changes.

## Out of scope

- **Fitting every concept the element joins.** Adding another concept's section to an element is `graph add-to-concept` (A10.22), and changing its fields is `graph update-node` (A10.21). `rules check` (A10.31) reports an element that doesn't fit a concept it belongs to.
- **Uniqueness the schema asks for beyond the repeat** (`x-tapestry.unique`, such as a concept that marks another field unique): a concept-dependent rule (design §7), for a story of its own. The repeat (AC4) keeps an instance's own elements of a concept from sharing a slug.
- **Reporting near matches,** as create-concept reports similar concepts.
- **An element that is itself a concept** (tapestry-concepts.md, "Kind unification"), and an element under no concept: every element this makes belongs to at least one (D9).
- **Nested objects and lists of objects as node properties** (design §5, question 1): a marked field stays plain, as A10.5 left it.
- **Today's create-element and add-to-set routes,** which stay as they are (D15), and their field mapping (A10.5.a).
- **Moving, changing or removing an element** (A10.21–A10.23, A10.26).
- **Publishing an element** as a nostr event (`export nostr`, A10.34). An element made here is a private thought until then (BIBLE §30).
- **Bulk creates** (catalog §10, question 6): one element per call.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved all three (2026-11-16).

1. **`concept` or `set`?** *Resolved: `concept` is required, and `set` is optional* (the drafting's proposal, approved by the owner, 2026-11-16). AC1, AC2, AC5. The concept decides which section the fields go in, which schema they meet and where the repeat looks, and a set can sit in several concepts' class threads (when one concept is a kind of another), so a set alone can leave the concept open. An agent knows the concept: it made the set under it. The catalog's other reading, either one alone, finds the concept from the set and refuses a set that more than one concept's class thread reaches equally.
2. **What about the other concepts an element joins through its set?** *Resolved: check the named concept's schema only, and report the others* (the drafting's proposal, approved by the owner, 2026-11-16). AC3. Refusing until the element fits every concept its set reaches would need a section for each, which only add-to-concept (A10.22) makes. This matches story 28, whose link-set doesn't check the elements a link brings into another concept: `rules check` (A10.31) reports them.
3. **What about a field the schema requires that the caller leaves out?** *Resolved: refuse it, naming the field; never fill in a value* (the drafting's proposal, approved by the owner, 2026-11-16). AC3. Today's route fills empty values in, and an element of a concept today's create-concept made needs a description. The agent can give an empty one on purpose, but the operation doesn't decide that for it.

**Added at Architecture** (the owner's approval, 2026-11-16, with ADR 0020): AC5's list gains `made-elsewhere`, for an element of a concept whose elements another operation makes: the concept-header concept and the seven core-node concepts (graph create-concept), set (graph create-set), property (graph add-property) and graph rule (the rulebook). The ADR's other refusals beyond the list, `not-installed`, `no-free-address` and a length limit on the element's JSON, are mechanics create-concept has too.

For Architecture, not this gate:

- **How the guard checks the JSON before the write.** A guard sees only the inputs, and the JSON needs the concept's key and schema from the graph. ADR 0016's pattern, a guard and the same rule run again in `apply`, may fit.
- **Which JSON Schema dialect the check reads.** The derive step drops `$schema` and reads with ajv's defaults; today's schemas name draft 2020-12. A check that disagrees with the derive step's verdict would make an element one says fits and the other doesn't.
- **The `word` block's slug, name and title,** and the order of `wordTypes`. Firmware's rover has `dog--rover` and "dog: Rover"; the graph rule elements use their own slug.
- **The address when the d-tag is held:** versioning nonces, as create-concept's are.
- **Shared-concept stamps.** Today's route adds a `z` for each shared concept the header's `b` tags point to. A letter for the element would carry them, and a reinstall would then link those concepts' supersets to it.
- **The links a reinstall leaves** for an element in a set, since pass 1d adds a direct link from the concept's superset (fact 9): wire that link too, as ADR 0016 Amendment 2 wired what a reinstall leaves, or leave it to the reinstall. The live check decides.
- **How `fields` gets from a command line to the operation** (fact 10): an input that takes an object or its JSON text, or a change to both CLIs.
- **Two creates at once:** which lock makes two calls with one name make one element.
- **An element's slug, for the repeat:** its section's `slug`, else its name's, for elements today's route made with other JSON.
- **The change entry's shape:** the element made, its concept and set, and the copies.
- **Where the shared check lives,** and how A10.21, A10.22 and A10.18 call it.

## Deviations

- **`_fields.js` also exports `readJson`,** beside ADR 0020's `conceptsOfNodes`. So `_schemas.js` reads a schema node's json tag, inline or an LMDB reference, exactly as the field mapping reads an element's, not with a copy. Nothing else in `_fields.js` changes.
- **E1 and E4 also return the node's name and address,** for messages: a refusal names the concept as `"coffee house" (39998:…:coffee-house)`. E4 then answers no row for a key no node has, where the ADR's text answers one row of null.
- **The rule's `{ concept, json }` message names the concept, not the element** ("The element's JSON doesn't fit the JSON schema of …"), since the item carries no name. create-element's `invalid-fields` refusal is that message, so it carries `rule` but not `input`, as the write path's guard refusals do (ADR graph-operations-foundation/0004 Decision 3). Each problem in it names its field.
- **`copies` is a sorted list of the node properties the element now carries,** such as `dog_breed`. Decision 14 left its shape open.
- **The refusals for `set` are worded for create-element** (`_elements.js`'s `say`), not with link-set's messages, whose advice is about linking.
- **Two things are failures (500), not refusals:** a concept header with no address, and one with no name to make it a key. No graph the operations or the import make has either, and Decision 18 lists no code for them.
- **The live check's firmware is the image's** (`agent-memory-tapestry:latest`): `scratch-stack.sh` mounts `src/` only. That firmware has no golden retriever concept, so firmware's dog was checked directly, not through a set. It also lacks rule 7's element, which reaches an instance only with a firmware reinstall after the change (ledger row `2026-11-16-rule-seven-awaits-firmware-reinstall`).
- **Only this story's suites, and those sharing its files, ran on this Mac.** That is the task's rule: the full `npm test` writes to the agent-memory instance. `test/operations.test.js` as a whole, and the route-surface suites (openapi-coverage, admin-action-sweep), run in the PR's CI gate.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild bullet)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D2, D4, D6, D7, D9, D10, D11, D15); catalog §2, Nodes
- The node with no event, and the names it checks: [16-create-concept-and-update-concept.md](16-create-concept-and-update-concept.md) (ADR 0016 Decisions 1 and 2)
- The sets and class threads it reads: [28-link-set-and-unlink-set.md](28-link-set-and-unlink-set.md)
- The field marks it carries: [stories/graph-operations-foundation/5-field-mapping.md](../graph-operations-foundation/5-field-mapping.md)
- The rulebook and its graph rule concept: [docs/GRAPH_RULES.md](../../../docs/GRAPH_RULES.md); [41-graph-rule-concept.md](41-graph-rule-concept.md)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0020-create-element.md](../../decisions/graph-operations-first-slice/0020-create-element.md)
- Test plan: [20-create-element.test-plan.md](20-create-element.test-plan.md)
- Review: (filled in after Review)
